const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class ApiClient {
  async request(endpoint: string, options: RequestInit = {}, _isRetry = false): Promise<any> {
    const token = localStorage.getItem('token');

    let response: Response;
    try {
      response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
      });
    } catch (error) {
      throw { message: 'Network error. Please check your connection and try again.' };
    }

    const isAuthEndpoint = endpoint.startsWith('/auth/');

    // On 401, try refreshing the token before giving up
    if (response.status === 401 && !isAuthEndpoint && !_isRetry) {
      const refreshed = await this.tryRefreshToken();
      if (refreshed) {
        // Retry the original request with new token
        return this.request(endpoint, options, true);
      }
      // Refresh failed — redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      const currentPath = window.location.pathname;
      window.location.href = currentPath !== '/login' ? `/login?redirect=${encodeURIComponent(currentPath)}` : '/login';
      throw { message: 'Session expired. Please log in again.' };
    }

    if (response.status === 401 && !isAuthEndpoint && _isRetry) {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      const currentPath = window.location.pathname;
      window.location.href = currentPath !== '/login' ? `/login?redirect=${encodeURIComponent(currentPath)}` : '/login';
      throw { message: 'Session expired. Please log in again.' };
    }

    // Handle responses with no body (204 No Content, some errors)
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      if (!response.ok) {
        throw { message: `Request failed (${response.status})` };
      }
      return {};
    }

    let data;
    try {
      data = await response.json();
    } catch {
      // Malformed JSON from server
      throw { message: 'Invalid response from server' };
    }

    if (!response.ok) throw data;
    return data;
  }

  // Try to get a new access token using the stored refresh token
  private async tryRefreshToken(): Promise<boolean> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // AUTH
  login = (credentials: any) =>
    this.request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) });

  register = (data: any) =>
    this.request('/auth/register', { method: 'POST', body: JSON.stringify(data) });

  verifyEmail = (token: string) =>
    this.request(`/auth/verify-email?token=${token}`);

  resendVerification = (email: string) =>
    this.request('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) });

  // Logout endpoint
  logout = () =>
    this.request('/auth/logout', { method: 'POST' });

  // 2FA
  verify2FA = (email: string, code: string) =>
    this.request('/auth/verify-2fa', { method: 'POST', body: JSON.stringify({ email, code }) });

  enable2FA = (password: string) =>
    this.request('/auth/enable-2fa', { method: 'POST', body: JSON.stringify({ password }) });

  disable2FA = (password: string) =>
    this.request('/auth/disable-2fa', { method: 'POST', body: JSON.stringify({ password }) });

  get2FAStatus = () =>
    this.request('/auth/2fa-status');

  // PASSWORD RESET
  requestPasswordReset = (email: string) =>
    this.request('/password-reset/request', { method: 'POST', body: JSON.stringify({ email }) });

  verifyResetToken = (token: string) =>
    this.request('/password-reset/verify', { method: 'POST', body: JSON.stringify({ token }) });

  resetPassword = (token: string, newPassword: string) =>
    this.request('/password-reset/reset', { method: 'POST', body: JSON.stringify({ token, newPassword }) });

  // POSTS
  getPosts = () =>
    this.request('/posts/feed');

  getPost = (id: number) =>
    this.request(`/posts/${id}`);

  createPost = (data: any) =>
    this.request('/posts', { method: 'POST', body: JSON.stringify(data) });

  deletePost = (id: number) =>
    this.request(`/posts/${id}`, { method: 'DELETE' });

  // Edit post caption
  editPost = (id: number, caption: string) =>
    this.request(`/posts/${id}`, { method: 'PUT', body: JSON.stringify({ caption }) });

  likePost = (id: number) =>
    this.request(`/posts/${id}/like`, { method: 'POST' });

  unlikePost = (id: number) =>
    this.request(`/posts/${id}/like`, { method: 'DELETE' });

  getComments = (postId: number) =>
    this.request(`/posts/${postId}/comments`);

  addComment = (postId: number, body: string) =>
    this.request(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ body }) });

  // Edit/delete comments
  editComment = (postId: number, commentId: number, body: string) =>
    this.request(`/posts/${postId}/comments/${commentId}`, { method: 'PUT', body: JSON.stringify({ body }) });

  deleteComment = (postId: number, commentId: number) =>
    this.request(`/posts/${postId}/comments/${commentId}`, { method: 'DELETE' });

  // SAVED POSTS
  savePost = (postId: number) =>
    this.request(`/saved-posts/${postId}`, { method: 'POST' });

  unsavePost = (postId: number) =>
    this.request(`/saved-posts/${postId}`, { method: 'DELETE' });

  getSavedPosts = () =>
    this.request('/saved-posts');

  // USERS
  getProfile = (username: string) =>
    this.request(`/users/profile/${username}`);

  updateProfile = (data: any) =>
    this.request('/users/profile', { method: 'PUT', body: JSON.stringify(data) });

  updateAvatar = (avatar_base64: string) =>
    this.request('/users/avatar', { method: 'PUT', body: JSON.stringify({ avatar_base64 }) });

  updateCover = (cover_base64: string) =>
    this.request('/users/cover', { method: 'PUT', body: JSON.stringify({ cover_base64 }) });

  updatePrivacy = (is_private: boolean) =>
    this.request('/users/privacy', { method: 'PUT', body: JSON.stringify({ is_private }) });

  deleteAccount = (password: string) =>
    this.request('/users/account', { method: 'DELETE', body: JSON.stringify({ password }) });

  follow = (id: number) =>
    this.request(`/users/follow/${id}`, { method: 'POST' });

  unfollow = (id: number) =>
    this.request(`/users/follow/${id}`, { method: 'DELETE' });

  changePassword = (currentPassword: string, newPassword: string) =>
    this.request('/users/change-password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) });

  changeEmail = (newEmail: string, password: string) =>
    this.request('/users/change-email', { method: 'PUT', body: JSON.stringify({ newEmail, password }) });

  verifyEmailChange = (code: string) =>
    this.request('/users/verify-email-change', { method: 'POST', body: JSON.stringify({ code }) });

  // FOLLOWERS / FOLLOWING LISTS
  getFollowers = (userId: number) =>
    this.request(`/users/${userId}/followers`);

  getFollowing = (userId: number) =>
    this.request(`/users/${userId}/following`);

  // FOLLOW REQUESTS
  getFollowRequests = () =>
    this.request('/users/follow-requests');

  acceptFollowRequest = (requestId: number) =>
    this.request(`/users/follow-requests/${requestId}/accept`, { method: 'POST' });

  rejectFollowRequest = (requestId: number) =>
    this.request(`/users/follow-requests/${requestId}/reject`, { method: 'POST' });

  // BLOCK
  blockUser = (userId: number) =>
    this.request(`/users/block/${userId}`, { method: 'POST' });

  unblockUser = (userId: number) =>
    this.request(`/users/block/${userId}`, { method: 'DELETE' });

  getBlockedUsers = () =>
    this.request('/users/blocked');

  // DEVICE PIN
  checkDeviceStatus = (fingerprint: string) =>
    this.request('/users/device/check', { method: 'POST', body: JSON.stringify({ fingerprint }) });

  setupDevicePin = (fingerprint: string, pin: string) =>
    this.request('/users/device/setup', { method: 'POST', body: JSON.stringify({ fingerprint, pin }) });

  verifyDevicePin = (fingerprint: string, pin: string) =>
    this.request('/users/device/verify', { method: 'POST', body: JSON.stringify({ fingerprint, pin }) });

  // STORIES
  getStories = () =>
    this.request('/stories');

  createStory = (image_base64: string) =>
    this.request('/stories', { method: 'POST', body: JSON.stringify({ image_base64 }) });

  // Delete story
  deleteStory = (id: number) =>
    this.request(`/stories/${id}`, { method: 'DELETE' });

  // Story views
  recordStoryView = (storyId: number) =>
    this.request(`/stories/${storyId}/view`, { method: 'POST' });

  getStoryViews = (storyId: number) =>
    this.request(`/stories/${storyId}/views`);

  // ═══════════════════════════════════════════════════════════════════════════════
  // MESSAGES (DM) — Revamped
  // ═══════════════════════════════════════════════════════════════════════════════

  sendMessage = (receiver_id: number, content: string, reply_to_id?: number) =>
    this.request('/messages/send', { method: 'POST', body: JSON.stringify({ receiver_id, content, reply_to_id }) });

  sendRichMessage = (receiver_id: number, message_type: 'gif' | 'sticker', media_url: string) =>
    this.request('/messages/send-rich', { method: 'POST', body: JSON.stringify({ receiver_id, message_type, media_url }) });

  sendVoiceMessage = (receiver_id: number, audio_base64: string) =>
    this.request('/messages/send-voice', { method: 'POST', body: JSON.stringify({ receiver_id, audio_base64 }) });

  sendImageMessage = (receiver_id: number, image_base64: string) =>
    this.request('/messages/send-image', { method: 'POST', body: JSON.stringify({ receiver_id, image_base64 }) });

  getMessages = (otherId: number, page = 1, limit = 50) =>
    this.request(`/messages/thread/${otherId}?page=${page}&limit=${limit}`);

  getMessagesLegacy = (otherId: number) =>
    this.request(`/messages/${otherId}`);

  getConversations = () =>
    this.request('/messages/conversations');

  markMessagesRead = (otherId: number) =>
    this.request(`/messages/read/${otherId}`, { method: 'PUT' });

  editMessage = (messageId: number, content: string) =>
    this.request(`/messages/edit/${messageId}`, { method: 'PUT', body: JSON.stringify({ content }) });

  deleteMessage = (messageId: number) =>
    this.request(`/messages/delete/${messageId}`, { method: 'DELETE' });

  sendTypingIndicator = (otherId: number) =>
    this.request(`/messages/typing/${otherId}`, { method: 'POST' });

  getTypingStatus = (otherId: number) =>
    this.request(`/messages/typing-status/${otherId}`);

  // ═══════════════════════════════════════════════════════════════════════════════
  // GROUP MESSAGING
  // ═══════════════════════════════════════════════════════════════════════════════

  createGroup = (name: string, member_ids?: number[], description?: string) =>
    this.request('/groups', { method: 'POST', body: JSON.stringify({ name, member_ids, description }) });

  getGroups = () =>
    this.request('/groups');

  getGroupDetails = (groupId: number) =>
    this.request(`/groups/${groupId}`);

  updateGroup = (groupId: number, data: { name?: string; description?: string }) =>
    this.request(`/groups/${groupId}`, { method: 'PUT', body: JSON.stringify(data) });

  deleteGroup = (groupId: number) =>
    this.request(`/groups/${groupId}`, { method: 'DELETE' });

  getGroupMessages = (groupId: number, page = 1, limit = 50) =>
    this.request(`/groups/${groupId}/messages?page=${page}&limit=${limit}`);

  sendGroupMessage = (groupId: number, content: string, reply_to_id?: number) =>
    this.request(`/groups/${groupId}/messages`, { method: 'POST', body: JSON.stringify({ content, reply_to_id }) });

  sendGroupImage = (groupId: number, image_base64: string) =>
    this.request(`/groups/${groupId}/messages/image`, { method: 'POST', body: JSON.stringify({ image_base64 }) });

  sendGroupRichMessage = (groupId: number, message_type: 'gif' | 'sticker', media_url: string) =>
    this.request(`/groups/${groupId}/messages/rich`, { method: 'POST', body: JSON.stringify({ message_type, media_url }) });

  sendGroupVoice = (groupId: number, audio_base64: string) =>
    this.request(`/groups/${groupId}/messages/voice`, { method: 'POST', body: JSON.stringify({ audio_base64 }) });

  getGroupMembers = (groupId: number) =>
    this.request(`/groups/${groupId}/members`);

  inviteToGroup = (groupId: number, user_ids: number[]) =>
    this.request(`/groups/${groupId}/invite`, { method: 'POST', body: JSON.stringify({ user_ids }) });

  leaveGroup = (groupId: number) =>
    this.request(`/groups/${groupId}/leave`, { method: 'POST' });

  kickFromGroup = (groupId: number, userId: number) =>
    this.request(`/groups/${groupId}/kick/${userId}`, { method: 'DELETE' });

  updateMemberRole = (groupId: number, userId: number, role: 'admin' | 'member') =>
    this.request(`/groups/${groupId}/role/${userId}`, { method: 'PUT', body: JSON.stringify({ role }) });

  muteGroup = (groupId: number, muted: boolean) =>
    this.request(`/groups/${groupId}/mute`, { method: 'PUT', body: JSON.stringify({ muted }) });

  toggleMuteAll = (groupId: number, mute_all: boolean) =>
    this.request(`/groups/${groupId}/mute-all`, { method: 'PUT', body: JSON.stringify({ mute_all }) });

  markGroupRead = (groupId: number) =>
    this.request(`/groups/${groupId}/read`, { method: 'PUT' });

  sendGroupTyping = (groupId: number) =>
    this.request(`/groups/${groupId}/typing`, { method: 'POST' });

  getGroupTypingStatus = (groupId: number) =>
    this.request(`/groups/${groupId}/typing-status`);

  getGroupInvitations = () =>
    this.request('/groups/invitations/pending');

  respondToInvitation = (invitationId: number, action: 'accept' | 'decline') =>
    this.request(`/groups/invitations/${invitationId}/respond`, { method: 'POST', body: JSON.stringify({ action }) });

  // ═══════════════════════════════════════════════════════════════════════════════
  // REACTIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  addReaction = (messageId: number, emoji: string) =>
    this.request(`/reactions/${messageId}`, { method: 'POST', body: JSON.stringify({ emoji }) });

  removeReaction = (messageId: number, emoji: string) =>
    this.request(`/reactions/${messageId}`, { method: 'DELETE', body: JSON.stringify({ emoji }) });

  getReactions = (messageId: number) =>
    this.request(`/reactions/${messageId}`);

  // NOTIFICATIONS
  getNotifications = () =>
    this.request('/notifications');

  markNotificationRead = (id: number) =>
    this.request(`/notifications/${id}/read`, { method: 'PUT' });

  getUnreadNotificationCount = () =>
    this.request('/notifications/unread-count');

  markAllNotificationsRead = () =>
    this.request('/notifications/mark-all-read', { method: 'PUT' });

  // SUGGESTIONS
  getSuggestions = () =>
    this.request('/suggestions');

  // SEARCH
  search = (query: string) =>
    this.request(`/search?q=${encodeURIComponent(query)}`);

  // HASHTAGS
  getTrendingHashtags = () =>
    this.request('/hashtags/trending');

  getHashtagPosts = (tag: string) =>
    this.request(`/hashtags/${encodeURIComponent(tag)}/posts`);

  searchHashtags = (query: string) =>
    this.request(`/hashtags/search?q=${encodeURIComponent(query)}`);

  // REPORTS
  submitReport = (data: any) =>
    this.request('/reports', { method: 'POST', body: JSON.stringify(data) });

  reportPost = (postId: number, reason: string) =>
    this.submitReport({ post_id: postId, reason });

  // HEARTBEAT & PRIVACY
  heartbeat = () =>
    this.request('/users/heartbeat', { method: 'POST' });

  updateOnlinePrivacy = (show_online_status?: boolean, show_last_seen?: boolean) =>
    this.request('/users/online-privacy', {
      method: 'PUT',
      body: JSON.stringify({ show_online_status, show_last_seen }),
    });

  // ADMIN
  getAdminStats = () =>
    this.request('/admin/stats');

  getReports = () =>
    this.request('/admin/reports');

  getAdminUsers = () =>
    this.request('/admin/users');

  resolveReport = (id: number) =>
    this.request(`/admin/reports/${id}/resolve`, { method: 'PUT' });

  banUser = (id: number) =>
    this.request(`/admin/users/${id}/ban`, { method: 'PUT' });

  unbanUser = (id: number) =>
    this.request(`/admin/users/${id}/unban`, { method: 'PUT' });

  getUserActivity = (id: number) =>
    this.request(`/admin/users/${id}/activity`);

  forcePasswordReset = (id: number) =>
    this.request(`/admin/users/${id}/force-reset`, { method: 'POST' });

  // CONTENT MODERATION
  getFlaggedPosts = () =>
    this.request('/admin/posts/flagged');

  approvePost = (id: number) =>
    this.request(`/admin/posts/${id}/approve`, { method: 'PUT' });

  deletePostAdmin = (id: number) =>
    this.request(`/admin/posts/${id}`, { method: 'DELETE' });

  // AUDIT LOG
  getAuditLog = () =>
    this.request('/admin/audit-log');

  // CONTENT PROTECTION
  reportScreenshot = (postId: number) =>
    this.request(`/posts/${postId}/screenshot-report`, { method: 'POST' });

  requestScreenshot = (postId: number) =>
    this.request(`/posts/${postId}/screenshot-request`, { method: 'POST' });

  respondScreenshot = (requestId: number, action: 'accept' | 'decline') =>
    this.request(`/posts/screenshot-requests/${requestId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
}

export const api = new ApiClient();