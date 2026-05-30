-- Migration 013: Verified testimonials after platform collaboration
CREATE TABLE IF NOT EXISTS testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id INT NOT NULL,
  subject_user_id INT NOT NULL,
  deal_room_id INT NOT NULL,
  text TEXT NOT NULL,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  verified_collaboration BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (author_user_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_user_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (deal_room_id) REFERENCES deal_rooms(id) ON DELETE CASCADE
);

CREATE INDEX idx_testimonials_author ON testimonials(author_user_id);
CREATE INDEX idx_testimonials_subject ON testimonials(subject_user_id);
CREATE INDEX idx_testimonials_deal ON testimonials(deal_room_id);
