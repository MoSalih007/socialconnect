export interface User {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  cover_url?: string;
  bio?: string;
  is_admin: boolean;
  is_private?: boolean;
  is_verified?: boolean;
  show_online_status?: boolean;
  show_last_seen?: boolean;
  created_at: string;
}

export interface UserStats {
  posts: number;
  followers: number;
  following: number;
}

export interface Post {
  id: number;
  user_id: number;
  image_url: string;
  media_type?: 'image' | 'video';
  caption?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  username?: string;
  avatar_url?: string;
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
  is_saved?: boolean;
  owner_is_private?: boolean;
}

export interface Comment {
  id: number; post_id: number; user_id: number;
  body: string; created_at: string;
  username?: string; avatar_url?: string;
}

export interface Story {
  id: number; user_id: number;
  image_url: string;
  created_at: string; expires_at: string;
  username?: string; avatar_url?: string;
}

export interface Message {
  id: number;
  sender_id: number;
  receiver_id?: number;
  group_id?: number;
  encrypted_content: string;
  message_type: 'text' | 'voice' | 'gif' | 'sticker' | 'image';
  media_url?: string;
  is_edited?: boolean;
  is_deleted?: boolean;
  is_blocked?: boolean;
  reply_to_id?: number;
  reply_preview?: ReplyPreview | null;
  reactions?: MessageReaction[];
  read_at?: string;
  created_at: string;
  // Group message extras
  sender_username?: string;
  sender_avatar?: string;
}

export interface ReplyPreview {
  id: number;
  sender_id: number;
  sender_username?: string;
  message_type: string;
  is_deleted: boolean;
  content: string;
}

export interface MessageReaction {
  emoji: string;
  user_id: number;
  username: string;
}

export interface Conversation {
  other_id: number;
  username: string;
  avatar_url?: string;
  full_name?: string;
  last_message?: string;
  last_message_at?: string;
  last_msg_sender_id?: number;
  unread_count?: number;
  is_online?: boolean;
  last_seen?: string;
}

export interface GroupConversation {
  id: number;
  name: string;
  description?: string;
  avatar_url?: string;
  created_by: number;
  member_count: number;
  my_role: 'admin' | 'member';
  my_muted: boolean;
  is_muted_all: boolean;
  last_message?: string;
  last_message_at?: string;
  last_msg_sender?: string;
  unread_count: number;
  created_at: string;
}

export interface GroupMember {
  user_id: number;
  username: string;
  avatar_url?: string;
  full_name?: string;
  role: 'admin' | 'member';
  nickname?: string;
  is_muted: boolean;
  joined_at: string;
  is_online?: boolean;
}

export interface GroupInvitation {
  id: number;
  group_id: number;
  group_name: string;
  group_avatar?: string;
  group_description?: string;
  inviter_id: number;
  inviter_username: string;
  inviter_avatar?: string;
  member_count: number;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export interface Notification {
  id: number; user_id: number; actor_id: number;
  actor_username: string; actor_avatar?: string;
  type: 'like' | 'comment' | 'follow' | 'follow_request'
      | 'post_saved' | 'screenshot_attempt' | 'screenshot_request';
  post_id?: number; comment_id?: number;
  screenshot_request_id?: number;
  is_read: boolean; created_at: string;
}