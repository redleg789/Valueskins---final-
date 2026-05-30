-- LinkedIn Connections: Tracks connections between users with shared ValueSkin data.
-- shared_valueskins stores professions both users hold.
-- mutual_communities stores community IDs both belong to.

CREATE TABLE IF NOT EXISTS linkedin_connections (
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connected_user_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connection_type     VARCHAR(50) NOT NULL DEFAULT 'connected'
                            CHECK (connection_type IN ('connected', 'pending', 'blocked')),
    connected_at        TIMESTAMPTZ,
    shared_valueskins   TEXT[],
    mutual_communities  BIGINT[],
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, connected_user_id),
    CHECK (user_id <> connected_user_id)
);

CREATE INDEX IF NOT EXISTS idx_linkedin_conn_user
    ON linkedin_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_conn_connected
    ON linkedin_connections(connected_user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_conn_type
    ON linkedin_connections(connection_type);
CREATE INDEX IF NOT EXISTS idx_linkedin_conn_shared_skins
    ON linkedin_connections USING GIN(shared_valueskins);

CREATE TRIGGER trg_linkedin_connections_updated_at
    BEFORE UPDATE ON linkedin_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
