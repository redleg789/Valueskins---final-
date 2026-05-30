export interface User {
  id: string;
  name: string;
  handle?: string;
  username?: string;
  email?: string;
  avatar?: string;
  bio?: string;
  followers?: number;
  following?: number;
  verified?: boolean;
  engagement?: number;
  posts?: number;
}
