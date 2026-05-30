use sqlx::PgPool;
use uuid::Uuid;
use crate::models::{Post, CreatePostRequest};

pub struct SocialService {
    pool: PgPool,
}

impl SocialService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create_post(&self, req: CreatePostRequest) -> Result<Post, sqlx::Error> {
        let id = Uuid::new_v4();
        sqlx::query_as::<_, Post>(
            r#"
            INSERT INTO posts (id, author_persona_id, content, media_urls)
            VALUES ($1, $2, $3, $4)
            RETURNING id, author_persona_id, content, media_urls, created_at, updated_at
            "#
        )
        .bind(id)
        .bind(req.author_persona_id)
        .bind(&req.content)
        .bind(&req.media_urls)
        .fetch_one(&self.pool)
        .await
    }
    
    pub async fn follow_persona(&self, follower_id: i64, following_id: i64) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING"
        )
        .bind(follower_id)
        .bind(following_id)
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }
    
    pub async fn unfollow_persona(&self, follower_id: i64, following_id: i64) -> Result<(), sqlx::Error> {
        sqlx::query(
            "DELETE FROM follows WHERE follower_id = $1 AND following_id = $2"
        )
        .bind(follower_id)
        .bind(following_id)
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }
}
