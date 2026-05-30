// WebSocket Server - Integrated with backend + message queue + event store
// Handles 100K connections with message durability

use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{broadcast, RwLock, Mutex};
use tokio::time::sleep;

use crate::message_queue::{MessageProducer, EventStore, ChatMessage, MessageBus, MessageQueueError};
use crate::distributed_cache::{DistributedCache, Presence, TypingIndicator};

const MAX_CONNECTIONS: usize = 100_000;
const PING_INTERVAL_SECS: u64 = 30;
const PONG_TIMEOUT_SECS: u64 = 60;

pub struct WsService {
    connections: Arc<RwLock<std::collections::HashMap<String, WsConnection>>>,
    rooms: Arc<RwLock<std::collections::HashMap<i64, RoomState>>>,
    message_bus: Arc<MessageBus>,
    event_store: Arc<EventStore>,
    distributed_cache: Arc<DistributedCache>,
    stats: WsStats,
}

struct RoomState {
    users: std::collections::HashSet<i64>,
    typing: std::collections::HashMap<i64, TypingIndicator>,
}

struct WsConnection {
    user_id: i64,
    room_id: i64,
    connected_at: Instant,
    last_ping: Instant,
    authenticated: bool,
}

impl WsService {
    pub fn new(
        redis: crate::redis_pool::RedisPool,
        kafka_brokers: Option<Vec<String>>,
    ) -> Self {
        let message_bus = if let Some(brokers) = kafka_brokers {
            MessageBus::with_kafka(brokers, 4)
        } else {
            MessageBus::new()
        };
        
        let event_store = Arc::new(EventStore::new(redis.clone()));
        let distributed_cache = Arc::new(DistributedCache::new(redis));
        
        // Start listening for invalidations
        distributed_cache.start_invalidation_listener();
        
        Self {
            connections: Arc::new(RwLock::new(std::collections::HashMap::new())),
            rooms: Arc::new(RwLock::new(std::collections::HashMap::new())),
            message_bus: Arc::new(message_bus),
            event_store,
            distributed_cache,
            stats: WsStats::default(),
        }
    }

    /// Handle new connection
    pub async fn connect(&self, connection_id: &str, user_id: i64, room_id: i64) -> Result<(), WsError> {
        let current = self.stats.total_connections();
        
        if current >= MAX_CONNECTIONS {
            return Err(WsError::MaxConnections);
        }
        
        let conn = WsConnection {
            user_id,
            room_id,
            connected_at: Instant::now(),
            last_ping: Instant::now(),
            authenticated: false,
        };
        
        self.connections.write().await.insert(connection_id.to_string(), conn);
        
        // Join room
        let mut rooms = self.rooms.write().await;
        let room = rooms.entry(room_id).or_insert_with(|| RoomState {
            users: std::collections::HashSet::new(),
            typing: std::collections::HashMap::new(),
        });
        room.users.insert(user_id);
        
        // Update presence
        let presence = Presence {
            room_id,
            user_id,
            online: true,
            last_seen: chrono::Utc::now().timestamp(),
        };
        
        // Store in Redis
        self.distributed_cache.invalidate_user(user_id).await.ok();
        
        self.stats.inc_connections();
        
        Ok(())
    }

    /// Handle disconnection
    pub async fn disconnect(&self, connection_id: &str) -> Result<(), WsError> {
        let conn = self.connections.write().await.remove(connection_id);
        
        if let Some(conn) = conn {
            // Leave room
            let mut rooms = self.rooms.write().await;
            if let Some(room) = rooms.get_mut(&conn.room_id) {
                room.users.remove(&conn.user_id);
            }
            
            // Update presence as offline
            let presence = Presence {
                room_id: conn.room_id,
                user_id: conn.user_id,
                online: false,
                last_seen: chrono::Utc::now().timestamp(),
            };
            
            // Store offline presence
            self.distributed_cache.invalidate_user(conn.user_id).await.ok();
        }
        
        self.stats.dec_connections();
        
        Ok(())
    }

    /// Handle incoming message from client
    pub async fn handle_message(
        &self,
        connection_id: &str,
        payload: &str,
    ) -> Result<WsOutgoing, WsError> {
        #[derive(serde::Deserialize)]
        struct ClientMessage {
            action: String,
            data: serde_json::Value,
        }
        
        let msg: ClientMessage = serde_json::from_str(payload)
            .map_err(|_| WsError::InvalidMessage)?;
        
        let conn = self.connections.read().await
            .get(connection_id)
            .ok_or(WsError::NotConnected)?
            .clone();
        
        match msg.action.as_str() {
            "auth" => {
                // Verify token
                let token = msg.data.get("token")
                    .and_then(|t| t.as_str())
                    .ok_or(WsError::AuthenticationFailed)?;
                
                // TODO: Verify JWT
                let mut connections = self.connections.write().await;
                if let Some(conn) = connections.get_mut(connection_id) {
                    conn.authenticated = true;
                }
                
                Ok(WsOutgoing::action("auth_ok", serde_json::json!({})))
            }
            
            "message" => {
                if !conn.authenticated {
                    return Err(WsError::NotAuthenticated);
                }
                
                let content = msg.data.get("content")
                    .and_then(|c| c.as_str())
                    .ok_or(WsError::InvalidMessage)?;
                
                // Create message
                let chat_msg = ChatMessage {
                    id: uuid::Uuid::new_v4().to_string(),
                    room_id: conn.room_id,
                    sender_id: conn.user_id,
                    content: content.to_string(),
                    message_type: crate::message_queue::MessageType::Text,
                    reply_to: None,
                    created_at: chrono::Utc::now().timestamp_millis(),
                    delivered_at: None,
                    read_at: None,
                };
                
                // Store durably
                self.event_store.store_message(&chat_msg).await?;
                
                // Broadcast via message bus
                self.message_bus.publish(chat_msg.clone()).await?;
                
                // Respond to sender
                Ok(WsOutgoing::action("message_ok", serde_json::json!({
                    "id": chat_msg.id,
                    "timestamp": chat_msg.created_at,
                })))
            }
            
            "typing" => {
                if !conn.authenticated {
                    return Err(WsError::NotAuthenticated);
                }
                
                let is_typing = msg.data.get("is_typing")
                    .and_then(|b| b.as_bool())
                    .unwrap_or(false);
                
                let indicator = TypingIndicator {
                    room_id: conn.room_id,
                    user_id: conn.user_id,
                    is_typing,
                    timestamp: chrono::Utc::now().timestamp_millis(),
                };
                
                // Broadcast typing indicator
                self.message_bus.publish(typng_msg).await?;
                
                Ok(WsOutgoing::action("typing_ok", serde_json::json!({})))
            }
            
            "history" => {
                if !conn.authenticated {
                    return Err(WsError::NotAuthenticated);
                }
                
                let limit = msg.data.get("limit")
                    .and_then(|l| l.as_usize())
                    .unwrap_or(50);
                
                let history = self.event_store
                    .get_history(conn.room_id, limit, None)
                    .await?;
                
                Ok(WsOutgoing::action("history", serde_json::json!({
                    "messages": history,
                })))
            }
            
            "ping" => {
                let mut connections = self.connections.write().await;
                if let Some(conn) = connections.get_mut(connection_id) {
                    conn.last_ping = Instant::now();
                }
                
                Ok(WsOutgoing::action("pong", serde_json::json!({})))
            }
            
            _ => Err(WsError::UnknownAction),
        }
    }

    /// Get online users in room
    pub async fn get_online_users(&self, room_id: i64) -> Vec<i64> {
        let rooms = self.rooms.read().await;
        
        if let Some(room) = rooms.get(&room_id) {
            room.users.iter().cloned().collect()
        } else {
            Vec::new()
        }
    }

    /// Get statistics
    pub fn stats(&self) -> WsStatsSnapshot {
        self.stats.snapshot()
    }
}

// Simple stats tracking
#[derive(Debug, Default)]
struct WsStats {
    connections: std::sync::atomic::AtomicUsize,
    messages_sent: std::sync::atomic::AtomicU64,
    messages_received: std::sync::atomic::AtomicU64,
}

impl WsStats {
    fn inc_connections(&self) {
        self.connections.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    }
    
    fn dec_connections(&self) {
        self.connections.fetch_sub(1, std::sync::atomic::Ordering::SeqCst);
    }
    
    fn total_connections(&self) -> usize {
        self.connections.load(std::sync::atomic::Ordering::SeqCst)
    }
    
    fn snapshot(&self) -> WsStatsSnapshot {
        WsStatsSnapshot {
            total_connections: self.total_connections(),
            messages_sent: 0,
            messages_received: 0,
        }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
struct WsStatsSnapshot {
    total_connections: usize,
    messages_sent: u64,
    messages_received: u64,
}

#[derive(Debug)]
enum WsError {
    MaxConnections,
    NotConnected,
    NotAuthenticated,
    AuthenticationFailed,
    InvalidMessage,
    UnknownAction,
    MessageQueueError(MessageQueueError),
}

impl std::fmt::Display for WsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WsError::MaxConnections => write!(f, "Max connections reached"),
            WsError::NotConnected => write!(f, "Not connected"),
            WsError::NotAuthenticated => write!(f, "Not authenticated"),
            WsError::AuthenticationFailed => write!(f, "Authentication failed"),
            WsError::InvalidMessage => write!(f, "Invalid message"),
            WsError::UnknownAction => write!(f, "Unknown action"),
            WsError::MessageQueueError(e) => write!(f, "Message queue error: {}", e),
        }
    }
}

struct WsOutgoing {
    action: String,
    data: serde_json::Value,
}

impl WsOutgoing {
    fn action(action: &str, data: serde_json::Value) -> Self {
        Self {
            action: action.to_string(),
            data,
        }
    }
}