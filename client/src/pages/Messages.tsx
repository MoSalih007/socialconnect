import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Send, Image, Search, Smile, Sticker, Film,
  Users, Plus, Mail, Check, CheckCheck,
  Pencil, Info, X, Crown, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { Avatar } from '../components/ui/Avatar';
import { VoiceRecorder } from '../components/chat/VoiceRecorder';
import { GifPicker } from '../components/chat/GifPicker';
import { StickerPicker } from '../components/chat/StickerPicker';
import { EmojiPicker } from '../components/chat/EmojiPicker';
import { DateSeparator } from '../components/chat/DateSeparator';
import { TypingIndicator } from '../components/chat/TypingIndicator';
import { ReplyPreview } from '../components/chat/ReplyPreview';
import { ImageLightbox } from '../components/chat/ImageLightbox';
import { MessageReactions } from '../components/chat/MessageReactions';
import { MessageContextMenu } from '../components/chat/MessageContextMenu';
import { GroupAvatar } from '../components/chat/GroupAvatar';
import { CreateGroupModal } from '../components/chat/CreateGroupModal';
import { InviteMembersModal } from '../components/chat/InviteMembersModal';
import { GroupInfoDrawer } from '../components/chat/GroupInfoDrawer';
import { api } from '../lib/api';
import { pageVariants } from '../lib/animations';
import toast from 'react-hot-toast';
import type {
  Conversation, GroupConversation, GroupMember, GroupInvitation,
  Message, ReplyPreview as ReplyPreviewType
} from '../types';

type TabType = 'dms' | 'groups' | 'invites';
type ChatMode = 'dm' | 'group';

export function Messages() {
  const currentUser = useAuthStore((s) => s.user);
  const [searchParams] = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ─── State ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabType>('dms');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<GroupConversation[]>([]);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);

  // Active chat
  const [chatMode, setChatMode] = useState<ChatMode>('dm');
  const [selectedDM, setSelectedDM] = useState<Conversation | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupConversation | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);

  // Messages
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // UI state
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Message actions
  const [replyTo, setReplyTo] = useState<ReplyPreviewType | null>(null);
  const [replyToSenderName, setReplyToSenderName] = useState('');
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [contextMenu, setContextMenu] = useState<{ message: Message; x: number; y: number } | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Typing
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ userId: number; username: string }[]>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Polling
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const convPollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // ─── Load conversations on mount ────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const data = await api.getConversations();
      setConversations(Array.isArray(data) ? data.map((c: any) => ({
        other_id: c.other_id,
        username: c.username,
        avatar_url: c.avatar_url,
        full_name: c.full_name,
        last_message: c.last_message,
        last_message_at: c.last_message_at,
        last_msg_sender_id: c.last_msg_sender_id,
        unread_count: c.unread_count,
        is_online: c.is_online,
        last_seen: c.last_seen,
      })) : []);
    } catch {}
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const data = await api.getGroups();
      setGroups(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  const fetchInvitations = useCallback(async () => {
    try {
      const data = await api.getGroupInvitations();
      setInvitations(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchConversations();
    fetchGroups();
    fetchInvitations();
    convPollRef.current = setInterval(() => {
      fetchConversations();
      fetchGroups();
      fetchInvitations();
    }, 5000);
    return () => { if (convPollRef.current) clearInterval(convPollRef.current); };
  }, [fetchConversations, fetchGroups, fetchInvitations]);

  // Deep link support: ?user=id&username=name
  useEffect(() => {
    const userId = searchParams.get('user');
    const username = searchParams.get('username');
    if (userId && username) {
      const conv: Conversation = {
        other_id: parseInt(userId),
        username,
        avatar_url: searchParams.get('avatar') || undefined,
      };
      setSelectedDM(conv);
      setChatMode('dm');
      setMobileShowChat(true);
    }
  }, [searchParams]);

  // ─── Load messages when selecting a conversation ────────────────────────────
  const loadMessages = useCallback(async (p = 1) => {
    if (chatMode === 'dm' && selectedDM) {
      if (p === 1) setLoadingMessages(true);
      else setLoadingMore(true);
      try {
        const data = await api.getMessages(selectedDM.other_id, p);
        const msgs = data.messages || data;
        if (p === 1) {
          setMessages(msgs);
          setPage(1);
        } else {
          setMessages(prev => [...msgs, ...prev]);
        }
        setHasMore(data.pagination ? p < data.pagination.totalPages : false);
        if (p === 1) api.markMessagesRead(selectedDM.other_id).catch(() => {});
      } catch { toast.error('Failed to load messages'); }
      finally { setLoadingMessages(false); setLoadingMore(false); }
    } else if (chatMode === 'group' && selectedGroup) {
      if (p === 1) setLoadingMessages(true);
      else setLoadingMore(true);
      try {
        const data = await api.getGroupMessages(selectedGroup.id, p);
        const msgs = data.messages || data;
        if (p === 1) {
          setMessages(msgs);
          setPage(1);
        } else {
          setMessages(prev => [...msgs, ...prev]);
        }
        setHasMore(data.pagination ? p < data.pagination.totalPages : false);
        if (p === 1) api.markGroupRead(selectedGroup.id).catch(() => {});
      } catch { toast.error('Failed to load messages'); }
      finally { setLoadingMessages(false); setLoadingMore(false); }
    }
  }, [chatMode, selectedDM, selectedGroup]);

  useEffect(() => {
    if (selectedDM || selectedGroup) {
      loadMessages(1);
    } else {
      setMessages([]);
    }
  }, [selectedDM, selectedGroup, loadMessages]);

  // Poll for new messages
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selectedDM && !selectedGroup) return;

    pollRef.current = setInterval(async () => {
      try {
        if (chatMode === 'dm' && selectedDM) {
          const data = await api.getMessages(selectedDM.other_id, 1);
          const msgs = data.messages || data;
          setMessages(msgs);

          // Typing status
          const ts = await api.getTypingStatus(selectedDM.other_id);
          setIsTyping(ts.isTyping);
        } else if (chatMode === 'group' && selectedGroup) {
          const data = await api.getGroupMessages(selectedGroup.id, 1);
          const msgs = data.messages || data;
          setMessages(msgs);

          const ts = await api.getGroupTypingStatus(selectedGroup.id);
          setTypingUsers(ts.typing || []);
        }
      } catch {}
    }, 3000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedDM, selectedGroup, chatMode]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (!loadingMore) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loadingMore]);

  // Load group members when selecting a group
  useEffect(() => {
    if (chatMode === 'group' && selectedGroup) {
      api.getGroupMembers(selectedGroup.id).then(setGroupMembers).catch(() => {});
    }
  }, [chatMode, selectedGroup]);

  // ─── Infinite scroll (load older messages) ────────────────────────────────
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || !hasMore || loadingMore) return;
    if (container.scrollTop < 60) {
      loadMessages(page + 1);
      setPage(p => p + 1);
    }
  }, [hasMore, loadingMore, page, loadMessages]);

  // ─── Send message ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = messageText.trim();
    if (!text) return;

    // Editing mode
    if (editingMessage) {
      try {
        await api.editMessage(editingMessage.id, text);
        setMessages(prev => prev.map(m => m.id === editingMessage.id ? { ...m, encrypted_content: text, is_edited: true } : m));
        toast.success('Message edited');
      } catch (err: any) { toast.error(err?.message || 'Failed to edit'); }
      setEditingMessage(null);
      setMessageText('');
      return;
    }

    setMessageText('');
    setReplyTo(null);

    try {
      if (chatMode === 'dm' && selectedDM) {
        await api.sendMessage(selectedDM.other_id, text, replyTo?.id);
      } else if (chatMode === 'group' && selectedGroup) {
        await api.sendGroupMessage(selectedGroup.id, text, replyTo?.id);
      }
      loadMessages(1);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send');
    }
  };

  // ─── Send rich / media messages ───────────────────────────────────────────
  const handleGifSelect = async (gifUrl: string) => {
    setShowGifPicker(false);
    try {
      if (chatMode === 'dm' && selectedDM) {
        await api.sendRichMessage(selectedDM.other_id, 'gif', gifUrl);
      } else if (chatMode === 'group' && selectedGroup) {
        await api.sendGroupRichMessage(selectedGroup.id, 'gif', gifUrl);
      }
      loadMessages(1);
    } catch { toast.error('Failed to send GIF'); }
  };

  const handleStickerSelect = async (stickerUrl: string) => {
    setShowStickerPicker(false);
    try {
      if (chatMode === 'dm' && selectedDM) {
        await api.sendRichMessage(selectedDM.other_id, 'sticker', stickerUrl);
      } else if (chatMode === 'group' && selectedGroup) {
        await api.sendGroupRichMessage(selectedGroup.id, 'sticker', stickerUrl);
      }
      loadMessages(1);
    } catch { toast.error('Failed to send sticker'); }
  };

  const handleVoiceSend = async (audioBase64: string) => {
    try {
      if (chatMode === 'dm' && selectedDM) {
        await api.sendVoiceMessage(selectedDM.other_id, audioBase64);
      } else if (chatMode === 'group' && selectedGroup) {
        await api.sendGroupVoice(selectedGroup.id, audioBase64);
      }
      loadMessages(1);
    } catch { toast.error('Failed to send voice'); }
  };

  const handleImageAttach = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/gif,image/webp';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          if (chatMode === 'dm' && selectedDM) {
            await api.sendImageMessage(selectedDM.other_id, base64);
          } else if (chatMode === 'group' && selectedGroup) {
            await api.sendGroupImage(selectedGroup.id, base64);
          }
          loadMessages(1);
        } catch { toast.error('Failed to send image'); }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // ─── Typing indicator ─────────────────────────────────────────────────────
  const handleTyping = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (chatMode === 'dm' && selectedDM) {
      api.sendTypingIndicator(selectedDM.other_id).catch(() => {});
    } else if (chatMode === 'group' && selectedGroup) {
      api.sendGroupTyping(selectedGroup.id).catch(() => {});
    }
    typingTimeoutRef.current = setTimeout(() => {}, 3000);
  };

  // ─── Message actions ──────────────────────────────────────────────────────
  const handleReply = (msg: Message) => {
    setReplyTo({
      id: msg.id,
      sender_id: msg.sender_id,
      sender_username: msg.sender_username,
      message_type: msg.message_type,
      is_deleted: msg.is_deleted || false,
      content: msg.encrypted_content,
    });
    const senderName = msg.sender_id === currentUser?.id ? 'You'
      : msg.sender_username || selectedDM?.username || 'User';
    setReplyToSenderName(senderName);
    inputRef.current?.focus();
  };

  const handleDelete = async (msg: Message) => {
    try {
      await api.deleteMessage(msg.id);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_deleted: true, encrypted_content: 'This message was deleted', media_url: undefined } : m));
      toast.success('Message deleted');
    } catch (err: any) { toast.error(err?.message || 'Failed to delete'); }
  };

  const handleEdit = (msg: Message) => {
    setEditingMessage(msg);
    setMessageText(msg.encrypted_content);
    inputRef.current?.focus();
  };

  const handleCopy = (msg: Message) => {
    navigator.clipboard.writeText(msg.encrypted_content);
    toast.success('Copied to clipboard');
  };

  const handleReact = async (messageId: number, emoji: string) => {
    try {
      await api.addReaction(messageId, emoji);
      loadMessages(1);
    } catch (err: any) { toast.error(err?.message || 'Failed'); }
  };

  const handleRemoveReaction = async (messageId: number, emoji: string) => {
    try {
      await api.removeReaction(messageId, emoji);
      loadMessages(1);
    } catch {}
  };

  const handleInvitationResponse = async (id: number, action: 'accept' | 'decline') => {
    try {
      await api.respondToInvitation(id, action);
      toast.success(action === 'accept' ? 'Joined group!' : 'Invitation declined');
      fetchInvitations();
      if (action === 'accept') fetchGroups();
    } catch (err: any) { toast.error(err?.message || 'Failed'); }
  };

  const handleLeaveGroup = async () => {
    if (!selectedGroup) return;
    try {
      await api.leaveGroup(selectedGroup.id);
      toast.success('Left group');
      setSelectedGroup(null);
      setMessages([]);
      fetchGroups();
    } catch (err: any) { toast.error(err?.message || 'Failed'); }
  };

  // Context menu handler
  const handleContextMenu = (e: React.MouseEvent, msg: Message) => {
    e.preventDefault();
    setContextMenu({ message: msg, x: e.clientX, y: e.clientY });
  };

  // ─── Filter conversations ────────────────────────────────────────────────
  const filteredConvos = conversations.filter(c =>
    c.username.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ─── Helper: format timestamp ────────────────────────────────────────────
  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return formatTime(ts);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // ─── Helper: should show date separator ────────────────────────────────
  const shouldShowDateSeparator = (msg: Message, prevMsg?: Message) => {
    if (!prevMsg) return true;
    const d1 = new Date(msg.created_at).toDateString();
    const d2 = new Date(prevMsg.created_at).toDateString();
    return d1 !== d2;
  };

  // ─── Chat header content ─────────────────────────────────────────────────
  const chatActive = chatMode === 'dm' ? selectedDM : selectedGroup;

  // ─── Total unread badge for tabs ──────────────────────────────────────────
  const totalDMUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  const totalGroupUnread = groups.reduce((sum, g) => sum + (g.unread_count || 0), 0);

  // ─── Render message bubble ────────────────────────────────────────────────
  const renderMessage = (msg: Message, idx: number) => {
    const isOwn = msg.sender_id === currentUser?.id;
    const prevMsg = idx > 0 ? messages[idx - 1] : undefined;
    const showDate = shouldShowDateSeparator(msg, prevMsg);

    return (
      <div key={msg.id}>
        {showDate && <DateSeparator date={msg.created_at} />}

        <div
          className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1 group px-2`}
          onContextMenu={(e) => !msg.is_deleted && handleContextMenu(e, msg)}
        >
          {/* Group avatar for non-own messages */}
          {chatMode === 'group' && !isOwn && (
            <div className="flex-shrink-0 mr-2 mt-auto">
              <Avatar src={msg.sender_avatar} alt={msg.sender_username || ''} size="xs" />
            </div>
          )}

          <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
            {/* Group: sender name */}
            {chatMode === 'group' && !isOwn && (
              <span className="text-[10px] font-semibold text-neon-cyan/70 ml-1 mb-0.5">
                {msg.is_blocked ? 'Blocked User' : msg.sender_username}
              </span>
            )}

            {/* Reply preview */}
            {msg.reply_preview && !msg.is_deleted && (
              <ReplyPreview
                reply={msg.reply_preview}
                senderName={
                  msg.reply_preview.sender_id === currentUser?.id ? 'You'
                    : msg.reply_preview.sender_username || selectedDM?.username || 'User'
                }
              />
            )}

            {/* Message bubble */}
            <div
              className={`relative rounded-2xl px-3.5 py-2 text-sm break-words ${
                msg.is_deleted
                  ? 'bg-white/[0.02] border border-white/[0.04] italic text-gray-500'
                  : msg.is_blocked
                    ? 'bg-white/[0.02] border border-white/[0.04] italic text-gray-500'
                    : isOwn
                      ? 'bg-neon-cyan/15 border border-neon-cyan/20 text-white'
                      : 'bg-surface border border-white/[0.06] text-white'
              }`}
            >
              {msg.is_deleted ? (
                <span className="text-gray-500 text-xs">🚫 This message was deleted</span>
              ) : msg.is_blocked ? (
                <span className="text-gray-500 text-xs">Message hidden</span>
              ) : msg.message_type === 'image' && msg.media_url ? (
                <img
                  src={msg.media_url}
                  alt="Attachment"
                  className="max-w-[260px] rounded-lg cursor-pointer hover:opacity-90 transition"
                  onClick={() => setLightboxSrc(msg.media_url!)}
                />
              ) : msg.message_type === 'gif' && msg.media_url ? (
                <img src={msg.media_url} alt="GIF" className="max-w-[220px] rounded-lg" />
              ) : msg.message_type === 'sticker' && msg.media_url ? (
                <span className="text-5xl">{msg.media_url}</span>
              ) : msg.message_type === 'voice' && msg.media_url ? (
                <audio controls className="max-w-[240px]" preload="metadata">
                  <source src={msg.media_url} type="audio/webm" />
                </audio>
              ) : (
                <span>{msg.encrypted_content}</span>
              )}
            </div>

            {/* Reactions */}
            {msg.reactions && msg.reactions.length > 0 && !msg.is_deleted && (
              <MessageReactions
                reactions={msg.reactions}
                currentUserId={currentUser?.id || 0}
                onAdd={(emoji) => handleReact(msg.id, emoji)}
                onRemove={(emoji) => handleRemoveReaction(msg.id, emoji)}
              />
            )}

            {/* Timestamp + status */}
            <div className={`flex items-center gap-1.5 mt-0.5 ${isOwn ? 'justify-end' : ''}`}>
              <span className="text-[9px] text-gray-600">{formatTime(msg.created_at)}</span>
              {msg.is_edited && !msg.is_deleted && (
                <span className="text-[9px] text-gray-600 italic">edited</span>
              )}
              {isOwn && chatMode === 'dm' && !msg.is_deleted && (
                <span className="text-[9px]">
                  {msg.read_at ? (
                    <CheckCheck size={12} className="text-neon-cyan" />
                  ) : (
                    <Check size={12} className="text-gray-500" />
                  )}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit" className="flex flex-col h-[calc(100vh-64px)]">
      <div className="flex flex-1 overflow-hidden">
        {/* ═══════ LEFT PANEL: Conversation List ═══════ */}
        <div className={`w-full md:w-[380px] md:min-w-[340px] border-r border-white/[0.06] flex flex-col bg-surface-dark/50 ${mobileShowChat ? 'hidden md:flex' : 'flex'}`}>
          {/* Header */}
          <div className="p-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-bold text-white">Messages</h1>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="p-2 rounded-lg hover:bg-white/[0.06] transition" title="New Group"
                >
                  <Users size={18} className="text-gray-400" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-3 bg-black/30 rounded-xl p-1">
              {(['dms', 'groups', 'invites'] as TabType[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all relative ${
                    activeTab === tab
                      ? 'bg-white/[0.08] text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {tab === 'dms' ? 'DMs' : tab === 'groups' ? 'Groups' : 'Invites'}
                  {tab === 'dms' && totalDMUnread > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-neon-cyan text-[9px] font-bold text-surface-dark rounded-full flex items-center justify-center">
                      {totalDMUnread}
                    </span>
                  )}
                  {tab === 'groups' && totalGroupUnread > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-neon-cyan text-[9px] font-bold text-surface-dark rounded-full flex items-center justify-center">
                      {totalGroupUnread}
                    </span>
                  )}
                  {tab === 'invites' && invitations.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-[9px] font-bold text-white rounded-full flex items-center justify-center">
                      {invitations.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 bg-black/30 border border-white/[0.04] rounded-xl text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-neon-cyan/20"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {/* DMs Tab */}
            {activeTab === 'dms' && (
              filteredConvos.length > 0 ? filteredConvos.map(c => (
                <button
                  key={c.other_id}
                  onClick={() => {
                    setSelectedDM(c);
                    setSelectedGroup(null);
                    setChatMode('dm');
                    setMobileShowChat(true);
                    setMessages([]);
                    setReplyTo(null);
                    setEditingMessage(null);
                  }}
                  className={`w-full flex items-center gap-3 p-3.5 hover:bg-white/[0.03] transition border-b border-white/[0.03] ${
                    selectedDM?.other_id === c.other_id && chatMode === 'dm' ? 'bg-white/[0.05]' : ''
                  }`}
                >
                  <Avatar src={c.avatar_url} alt={c.username} size="md" isOnline={c.is_online} />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white truncate">{c.username}</span>
                      {c.last_message_at && (
                        <span className="text-[10px] text-gray-500 flex-shrink-0 ml-2">
                          {formatDate(c.last_message_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-gray-400 truncate max-w-[200px]">
                        {c.last_message || 'No messages yet'}
                      </p>
                      {(c.unread_count || 0) > 0 && (
                        <span className="ml-2 min-w-[18px] h-[18px] bg-neon-cyan text-[9px] font-bold text-surface-dark rounded-full flex items-center justify-center flex-shrink-0 px-1">
                          {c.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )) : (
                <div className="p-6 text-center text-gray-500 text-sm">No conversations yet</div>
              )
            )}

            {/* Groups Tab */}
            {activeTab === 'groups' && (
              <>
                {filteredGroups.length > 0 ? filteredGroups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => {
                      setSelectedGroup(g);
                      setSelectedDM(null);
                      setChatMode('group');
                      setMobileShowChat(true);
                      setMessages([]);
                      setReplyTo(null);
                      setEditingMessage(null);
                    }}
                    className={`w-full flex items-center gap-3 p-3.5 hover:bg-white/[0.03] transition border-b border-white/[0.03] ${
                      selectedGroup?.id === g.id && chatMode === 'group' ? 'bg-white/[0.05]' : ''
                    }`}
                  >
                    <GroupAvatar name={g.name} avatarUrl={g.avatar_url} size="md" />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white truncate">{g.name}</span>
                        {g.last_message_at && (
                          <span className="text-[10px] text-gray-500 flex-shrink-0 ml-2">
                            {formatDate(g.last_message_at)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-xs text-gray-400 truncate max-w-[200px]">
                          {g.last_msg_sender ? `${g.last_msg_sender}: ` : ''}{g.last_message || 'No messages'}
                        </p>
                        {g.unread_count > 0 && (
                          <span className="ml-2 min-w-[18px] h-[18px] bg-neon-cyan text-[9px] font-bold text-surface-dark rounded-full flex items-center justify-center flex-shrink-0 px-1">
                            {g.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )) : (
                  <div className="p-6 text-center">
                    <p className="text-gray-500 text-sm mb-3">No groups yet</p>
                    <button
                      onClick={() => setShowCreateGroup(true)}
                      className="btn-primary text-sm px-4 py-2"
                    >
                      <Plus size={16} className="inline mr-1" /> Create Group
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Invitations Tab */}
            {activeTab === 'invites' && (
              invitations.length > 0 ? invitations.map(inv => (
                <div key={inv.id} className="p-4 border-b border-white/[0.03]">
                  <div className="flex items-center gap-3 mb-2">
                    <GroupAvatar name={inv.group_name} avatarUrl={inv.group_avatar} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{inv.group_name}</p>
                      <p className="text-[11px] text-gray-500">
                        Invited by <span className="text-gray-400">{inv.inviter_username}</span> · {inv.member_count} members
                      </p>
                    </div>
                  </div>
                  {inv.group_description && (
                    <p className="text-xs text-gray-400 mb-2 line-clamp-2">{inv.group_description}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleInvitationResponse(inv.id, 'accept')}
                      className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-neon-cyan/15 text-neon-cyan hover:bg-neon-cyan/25 transition"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleInvitationResponse(inv.id, 'decline')}
                      className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] transition"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              )) : (
                <div className="p-6 text-center text-gray-500 text-sm">
                  <Mail size={24} className="mx-auto mb-2 text-gray-600" />
                  No pending invitations
                </div>
              )
            )}
          </div>
        </div>

        {/* ═══════ RIGHT PANEL: Chat Area ═══════ */}
        <div className={`flex-1 flex flex-col ${mobileShowChat ? 'flex' : 'hidden md:flex'}`}>
          {chatActive ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 p-3 border-b border-white/[0.06] bg-surface-dark/30">
                <button
                  onClick={() => { setMobileShowChat(false); setSelectedDM(null); setSelectedGroup(null); }}
                  className="md:hidden p-1.5 rounded-lg hover:bg-white/[0.06] transition"
                >
                  <ArrowLeft size={20} className="text-gray-400" />
                </button>

                {chatMode === 'dm' && selectedDM && (
                  <>
                    <Avatar src={selectedDM.avatar_url} alt={selectedDM.username} size="sm" isOnline={selectedDM.is_online} />
                    <div className="flex-1 min-w-0">
                      <h2 className="text-sm font-bold text-white">{selectedDM.username}</h2>
                      <p className="text-[10px] text-gray-500">
                        {isTyping ? (
                          <span className="text-neon-cyan">typing...</span>
                        ) : selectedDM.is_online ? (
                          <span className="text-neon-green">Online</span>
                        ) : selectedDM.last_seen ? (
                          `Last seen ${formatDate(selectedDM.last_seen)}`
                        ) : 'Offline'}
                      </p>
                    </div>
                  </>
                )}

                {chatMode === 'group' && selectedGroup && (
                  <>
                    <GroupAvatar name={selectedGroup.name} avatarUrl={selectedGroup.avatar_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h2 className="text-sm font-bold text-white truncate">{selectedGroup.name}</h2>
                        {selectedGroup.my_role === 'admin' && (
                          <Crown size={12} className="text-yellow-400 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500">
                        {typingUsers.length > 0 ? (
                          <span className="text-neon-cyan">
                            {typingUsers.map(t => t.username).join(', ')} typing...
                          </span>
                        ) : (
                          `${selectedGroup.member_count} members`
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowGroupInfo(true)}
                      className="p-2 rounded-lg hover:bg-white/[0.06] transition"
                    >
                      <Info size={18} className="text-gray-400" />
                    </button>
                  </>
                )}
              </div>

              {/* Messages area */}
              <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-3 scrollbar-hide"
              >
                {loadingMore && (
                  <div className="flex justify-center py-3">
                    <Loader2 size={20} className="animate-spin text-gray-400" />
                  </div>
                )}

                {loadingMessages ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <Loader2 size={28} className="animate-spin text-neon-cyan" />
                    <p className="text-sm text-gray-500">Loading messages...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <Send size={32} className="text-gray-600" />
                    <p className="text-gray-500 text-sm">No messages yet. Say hello! 👋</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => renderMessage(msg, idx))
                )}

                {/* Typing indicator */}
                {chatMode === 'dm' && isTyping && (
                  <TypingIndicator name={selectedDM?.username} />
                )}
                {chatMode === 'group' && typingUsers.length > 0 && (
                  <TypingIndicator name={typingUsers[0]?.username} />
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Reply / Edit bar */}
              {replyTo && (
                <ReplyPreview
                  reply={replyTo}
                  senderName={replyToSenderName}
                  isInput
                  onClear={() => setReplyTo(null)}
                />
              )}
              {editingMessage && (
                <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border-l-2 border-l-yellow-500">
                  <Pencil size={14} className="text-yellow-400" />
                  <span className="text-xs text-yellow-400 font-medium flex-1">Editing message</span>
                  <button onClick={() => { setEditingMessage(null); setMessageText(''); }} className="p-1 hover:bg-white/[0.06] rounded-full">
                    <X size={14} className="text-gray-400" />
                  </button>
                </div>
              )}

              {/* Input area */}
              <div className="p-3 border-t border-white/[0.06] bg-surface-dark/30">
                <div className="flex items-end gap-2">
                  {!editingMessage && (
                    <div className="flex items-center gap-0.5">
                      <button onClick={handleImageAttach} className="p-2 rounded-lg hover:bg-white/[0.06] transition" title="Attach image">
                        <Image size={18} className="text-gray-400" />
                      </button>
                      <button onClick={() => { setShowGifPicker(!showGifPicker); setShowStickerPicker(false); setShowEmojiPicker(false); }} className="p-2 rounded-lg hover:bg-white/[0.06] transition" title="GIF">
                        <Film size={18} className="text-gray-400" />
                      </button>
                      <button onClick={() => { setShowStickerPicker(!showStickerPicker); setShowGifPicker(false); setShowEmojiPicker(false); }} className="p-2 rounded-lg hover:bg-white/[0.06] transition" title="Sticker">
                        <Sticker size={18} className="text-gray-400" />
                      </button>
                    </div>
                  )}

                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={messageText}
                      onChange={e => { setMessageText(e.target.value); handleTyping(); }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                      }}
                      placeholder={editingMessage ? 'Edit your message...' : 'Type a message...'}
                      rows={1}
                      className="w-full px-4 py-2.5 bg-black/30 border border-white/[0.06] rounded-xl text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-neon-cyan/20 resize-none max-h-[120px]"
                      style={{ height: 'auto', minHeight: '40px' }}
                      onInput={e => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                      }}
                    />
                  </div>

                  {!editingMessage && (
                    <button
                      onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); setShowStickerPicker(false); }}
                      className="p-2 rounded-lg hover:bg-white/[0.06] transition" title="Emoji"
                    >
                      <Smile size={18} className="text-gray-400" />
                    </button>
                  )}

                  {messageText.trim() ? (
                    <button onClick={handleSend} className="p-2.5 rounded-xl bg-neon-cyan/20 hover:bg-neon-cyan/30 transition" title="Send">
                      <Send size={18} className="text-neon-cyan" />
                    </button>
                  ) : !editingMessage ? (
                    <VoiceRecorder onSend={handleVoiceSend} />
                  ) : (
                    <button onClick={() => { setEditingMessage(null); setMessageText(''); }} className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition">
                      <X size={18} className="text-gray-400" />
                    </button>
                  )}
                </div>

                {/* Pickers */}
                <AnimatePresence>
                  {showGifPicker && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-2 overflow-hidden">
                      <GifPicker onSelect={handleGifSelect} onClose={() => setShowGifPicker(false)} />
                    </motion.div>
                  )}
                  {showStickerPicker && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-2 overflow-hidden">
                      <StickerPicker onSelect={handleStickerSelect} onClose={() => setShowStickerPicker(false)} />
                    </motion.div>
                  )}
                  {showEmojiPicker && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-2 overflow-hidden">
                      <EmojiPicker onSelect={(emoji: string) => setMessageText(prev => prev + emoji)} onClose={() => setShowEmojiPicker(false)} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
              <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.1) 0%, rgba(0,212,255,0.03) 100%)' }}>
                <Send size={32} className="text-neon-cyan/40" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-white mb-1">Your Messages</h3>
                <p className="text-sm text-gray-500 max-w-[280px]">
                  Select a conversation or create a group to start chatting
                </p>
              </div>
              <button
                onClick={() => setShowCreateGroup(true)}
                className="btn-primary text-sm px-5 py-2"
              >
                <Users size={16} className="inline mr-1.5" /> New Group
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══════ Modals & Overlays ═══════ */}
      {contextMenu && (
        <MessageContextMenu
          message={contextMenu.message}
          isOwn={contextMenu.message.sender_id === currentUser?.id}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
          onReply={() => handleReply(contextMenu.message)}
          onEdit={() => handleEdit(contextMenu.message)}
          onDelete={() => handleDelete(contextMenu.message)}
          onCopy={() => handleCopy(contextMenu.message)}
          onReact={(emoji) => handleReact(contextMenu.message.id, emoji)}
        />
      )}

      <AnimatePresence>
        {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      </AnimatePresence>

      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreated={() => { fetchGroups(); setActiveTab('groups'); }}
      />

      {selectedGroup && (
        <InviteMembersModal
          isOpen={showInviteModal}
          groupId={selectedGroup.id}
          onClose={() => setShowInviteModal(false)}
          onInvited={() => { api.getGroupMembers(selectedGroup.id).then(setGroupMembers).catch(() => {}); }}
        />
      )}

      {selectedGroup && (
        <GroupInfoDrawer
          isOpen={showGroupInfo}
          onClose={() => setShowGroupInfo(false)}
          group={selectedGroup}
          members={groupMembers}
          currentUserId={currentUser?.id || 0}
          onRefresh={() => {
            api.getGroupDetails(selectedGroup.id).then((g: any) => setSelectedGroup(g)).catch(() => {});
            api.getGroupMembers(selectedGroup.id).then(setGroupMembers).catch(() => {});
          }}
          onOpenInvite={() => { setShowGroupInfo(false); setShowInviteModal(true); }}
          onLeave={handleLeaveGroup}
        />
      )}
    </motion.div>
  );
}