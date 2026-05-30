use sqlx::PgPool;
use crate::model::Brand;

pub struct RecommendationService {
    pool: PgPool,
}

impl RecommendationService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn get_matching_brands(&self, score: i32, category: Option<String>) -> Result<Vec<Brand>, sqlx::Error> {
        let mut query = String::from("SELECT * FROM brands WHERE min_score <= $1");
        
        if category.is_some() {
            query.push_str(" AND category = $2");
        }
        
        query.push_str(" ORDER BY min_score DESC LIMIT 10");
        
        let q = sqlx::query_as::<_, Brand>(&query).bind(score);
        
        let q = if let Some(cat) = category {
            q.bind(cat)
        } else {
            q
        };
        
        q.fetch_all(&self.pool).await
    }
}
