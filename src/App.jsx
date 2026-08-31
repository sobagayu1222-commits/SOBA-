import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, Users, Loader2, Plus, Paperclip, X, CornerUpLeft, Trash2, ShieldCheck,
  Ban, Folder, History, Search, Copy, Lock, UserPlus, Eye, Settings, Check,
  Mic, MicOff, PhoneCall, PhoneOff, BarChart3, MessageCircle, Image as ImageIcon,
  Smile, Sticker, Link2, Home, LayoutGrid, Camera, Edit3, Info,
  ArrowDownCircle, ChevronsLeft, ChevronsRight, KeyRound, Bell, Music, Volume2, VolumeX,
} from 'lucide-react';

const FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');";

const ROOMS_KEY = 'studio:rooms';
const NOTIF_PREFIX = 'studio:notif:';
const NICKNAME_REGISTRY_KEY = 'studio:nickname-registry';
const ANNOUNCEMENT_KEY = 'studio:announcement';
const URL_REGEX = /(https?:\/\/[^\s<>"']+)/g;
const MENTION_REGEX = /@([^\s@]{1,20})/g;
const SITE_ADMIN_PASSPHRASE = 'SOBA=WES';
const GLOBAL_PRESENCE_KEY = 'studio:global-presence';
const GLOBAL_PRESENCE_TTL = 20000;
const NICK_KEY = 'studio:my-nickname';
const USERID_KEY = 'studio:my-userid';
const MSG_PREFIX = 'studio:messages:';
const PRESENCE_PREFIX = 'studio:presence:';
const READS_PREFIX = 'studio:reads:';
const PROFILE_PREFIX = 'studio:profile:';
const FILE_PREFIX = 'studio:file:';
const TYPING_PREFIX = 'studio:typing:';
const DM_PREFIX = 'studio:dm:';
const DM_INDEX_KEY = 'studio:dm-index';
const DM_READS_PREFIX = 'studio:dm-reads:';
const STAMP_PREFIX = 'studio:stamps:';
const MOMENTS_KEY = 'studio:moments';
const PROJECTS_KEY = 'studio:projects';
const PROJECT_COMMENTS_PREFIX = 'studio:project-comments:';
const PROJECT_CHAT_PREFIX = 'studio:project-chat:';
const CALL_STATE_PREFIX = 'studio:call-state:';
const CALL_SIGNAL_PREFIX = 'studio:call-signal:';

const MAX_MESSAGES = 3000;
const PRESENCE_TTL = 15000;
const TYPING_TTL = 4000;
const CALL_TTL = 20000;
const MAX_ORIGINAL_BYTES = 8 * 1024 * 1024;
const MAX_NONIMAGE_BYTES = 1.5 * 1024 * 1024;
const MAX_BGM_BYTES = 5 * 1024 * 1024;
const IMAGE_MAX_DIM = 900;
const IMAGE_QUALITY = 0.72;
const COMMENT_MAX_LEN = 500;
const BIO_MAX_LEN = 80;
const MOMENT_MAX_LEN = 140;
const MAX_STAMPS = 16;
const MAX_MOMENTS = 1000;
const MAX_PROJECTS = 500;
const MAX_PROJECT_COMMENTS = 1000;
const AVATAR_COLORS = ['#D6393A', '#4C97FF', '#5CB712', '#FF8C1A', '#9966FF', '#0FBD8C', '#FF66A3', '#5C6B47'];
const ICON_CHOICES = ['😀', '🐱', '🐶', '🚀', '🎨', '⭐', '🔥', '🌙', '🍀', '🦊', '🐼', '🌈', '⚡', '🎮', '📚', '☕'];
const SYMBOL_CHOICES = [
  '😀', '😂', '🥰', '😎', '🤔', '😢', '😡', '🙏', '🎉', '❤️', '⭐', '✨', '🔥', '💯',
  '👍', '👎', '☀️', '☔', '❄️', '🍀', '🎵', '🎮', '📷', '💡', '✅', '❌',
  '➡️', '⬅️', '⬆️', '⬇️', '★', '☆', '♪', '♥', '§', '†', '‡', '〶', '＠', '＃', '％', '＆', '〜', '…', '・',
];
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

// If VITE_METERED_APP_NAME / VITE_METERED_API_KEY are set (free account at
// https://dashboard.metered.ca), fetch real TURN credentials at call time.
// Falls back to STUN-only (works only on some networks) if not configured.
let _iceServersCache = null;
async function getIceServers() {
  const appName = import.meta.env.VITE_METERED_APP_NAME;
  const apiKey = import.meta.env.VITE_METERED_API_KEY;
  if (!appName || !apiKey) return ICE_SERVERS;
  if (_iceServersCache) return _iceServersCache;
  try {
    const res = await fetch(`https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`);
    if (!res.ok) return ICE_SERVERS;
    const servers = await res.json();
    _iceServersCache = Array.isArray(servers) && servers.length ? servers : ICE_SERVERS;
    return _iceServersCache;
  } catch (e) {
    return ICE_SERVERS;
  }
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function genUserId() {
  return (uid() + uid()).replace(/[^a-z0-9]/gi, '').slice(0, 16).toUpperCase();
}

function dmKey(a, b) {
  return [a, b].sort().join('__');
}

function fmtRelative(ts) {
  const diff = Date.now() - ts;
  if (diff < 45000) return 'たった今';
  if (diff < 3600000) return `約${Math.max(1, Math.floor(diff / 60000))}分前`;
  if (diff < 86400000) return `約${Math.floor(diff / 3600000)}時間前`;
  if (diff < 86400000 * 30) return `約${Math.floor(diff / 86400000)}日前`;
  return `約${Math.floor(diff / (86400000 * 30))}ヶ月前`;
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function avatarColor(nick) {
  return AVATAR_COLORS[hashStr(nick || '?') % AVATAR_COLORS.length];
}

function avatarChar(nick) {
  const t = (nick || '?').trim();
  return (t.charAt(0) || '?').toUpperCase();
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SITE_PASSWORD = import.meta.env.VITE_SITE_PASSWORD || '';

async function safeGet(key, shared) {
  if (!shared) {
    try {
      return window.localStorage.getItem('local:' + key);
    } catch (e) {
      return null;
    }
  }
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/kv_store?key=eq.${encodeURIComponent(key)}&select=value`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows && rows[0] ? rows[0].value : null;
  } catch (e) {
    return null;
  }
}

async function safeSet(key, value, shared) {
  if (!shared) {
    try {
      window.localStorage.setItem('local:' + key, value);
      return true;
    } catch (e) {
      return false;
    }
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/kv_store`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ key, value }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

function parseList(raw) {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

function extractMentions(text) {
  if (!text) return [];
  const out = [];
  let m;
  MENTION_REGEX.lastIndex = 0;
  while ((m = MENTION_REGEX.exec(text))) out.push(m[1]);
  return out;
}

function renderRichText(text) {
  if (!text) return null;
  const tokens = text.split(/(https?:\/\/[^\s<>"']+|@[^\s@]{1,20})/g).filter((t) => t !== '');
  return tokens.map((tok, i) => {
    if (/^https?:\/\//.test(tok)) {
      return (
        <a key={i} href={tok} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--link)', wordBreak: 'break-all', textDecoration: 'underline' }} onClick={(e) => e.stopPropagation()}>
          {tok}
        </a>
      );
    }
    if (/^@[^\s@]{1,20}$/.test(tok)) {
      return (
        <span key={i} style={{ color: 'var(--owner)', fontWeight: 700 }}>{tok}</span>
      );
    }
    return <span key={i}>{tok}</span>;
  });
}

function parseObj(raw, fallback) {
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : fallback;
  } catch (e) {
    return fallback;
  }
}

function isBannedId(room, id) {
  return !!room && Array.isArray(room.bannedUserIds) && room.bannedUserIds.includes(id);
}

function canView(room, id) {
  if (!room) return false;
  if (!room.private) return true;
  if (room.ownerId === id) return true;
  return Array.isArray(room.allowedUserIds) && room.allowedUserIds.includes(id);
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function compressImage(file, maxDim = IMAGE_MAX_DIM, quality = IMAGE_QUALITY) {
  return new Promise((resolve, reject) => {
    readAsDataURL(file)
      .then((srcUrl) => {
        const img = new Image();
        img.onerror = () => reject(new Error('image load failed'));
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve({ dataUrl: canvas.toDataURL('image/jpeg', quality), width, height });
        };
        img.src = srcUrl;
      })
      .catch(reject);
  });
}

function approxBytesFromDataUrl(dataUrl) {
  const idx = dataUrl.indexOf(',');
  const base64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
  return Math.round(base64.length * 0.75);
}

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function computeAnalytics(messages) {
  const live = messages.filter((m) => !m.deleted);
  const counts = {};
  const byDay = {};
  let images = 0;
  let files = 0;
  let stamps = 0;
  live.forEach((m) => {
    counts[m.nickname] = (counts[m.nickname] || 0) + 1;
    if (m.attachment) {
      if (m.attachment.kind === 'image') images++;
      else if (m.attachment.kind === 'stamp') stamps++;
      else files++;
    }
    const day = new Date(m.ts).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
    byDay[day] = (byDay[day] || 0) + 1;
  });
  const topUsers = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const dayEntries = Object.entries(byDay).slice(-14);
  return {
    total: live.length,
    topUsers,
    dayEntries,
    images,
    files,
    stamps,
    maxDay: Math.max(1, ...dayEntries.map(([, c]) => c)),
    maxUser: Math.max(1, ...topUsers.map(([, c]) => c)),
  };
}

function Avatar({ userId: uId, nickname, profiles, avatarCache, size = 34, isOwner = false, isOnline = false, onClick }) {
  const profile = (profiles && profiles[uId]) || null;
  const color = (profile && profile.color) || avatarColor(nickname);
  const icon = profile && profile.icon;
  const imgUrl = profile && profile.avatarFileId && avatarCache ? avatarCache[uId] : null;
  return (
    <div
      title={nickname}
      onClick={onClick}
      style={{ position: 'relative', width: size, height: size, minWidth: size, flexShrink: 0, cursor: onClick ? 'pointer' : 'default' }}
    >
      <div
        style={{
          width: size, height: size, borderRadius: 6,
          background: imgUrl ? '#fff' : color, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          fontFamily: "'Inter', sans-serif", fontWeight: 800,
          fontSize: Math.max(12, size * (icon ? 0.56 : 0.42)),
          boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.55), 0 0 0 1px var(--line)',
        }}
      >
        {imgUrl ? <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (icon || avatarChar(nickname))}
      </div>
      {isOnline && (
        <div
          title="オンライン"
          style={{
            position: 'absolute', top: -2, right: -2, width: Math.max(7, size * 0.24), height: Math.max(7, size * 0.24),
            borderRadius: '50%', background: '#3BC46B', border: '2px solid var(--panel)',
          }}
        />
      )}
      {isOwner && (
        <div
          title="スタジオ管理者"
          style={{
            position: 'absolute', bottom: -5, right: -5, background: 'var(--accent)', color: '#fff',
            borderRadius: 4, fontSize: 9, fontWeight: 800, padding: '1px 3px', border: '2px solid var(--panel)',
            lineHeight: 1.3, fontFamily: "'Inter', sans-serif",
          }}
        >
          管
        </div>
      )}
    </div>
  );
}

function IdTag({ userId: uId }) {
  if (!uId) return null;
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: 'var(--ink-soft)',
      background: 'var(--panel-alt)', border: '1px solid var(--line)', borderRadius: 3, padding: '0 3px',
    }}>
      #{uId.slice(-5)}
    </span>
  );
}

function MessageText({ text, onJump }) {
  if (!text) return null;
  const parts = text.split(/(#msg:[a-zA-Z0-9]+|https?:\/\/[^\s<>"']+|@[^\s@]{1,20})/g).filter((t) => t !== '');
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^#msg:([a-zA-Z0-9]+)$/);
        if (m) {
          return (
            <button
              key={i}
              onClick={() => onJump(m[1])}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 2, background: 'var(--panel-alt)',
                border: '1px solid var(--owner)', color: 'var(--owner)', borderRadius: 4, padding: '0 4px',
                fontSize: 11, fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer', verticalAlign: 'middle',
              }}
            >
              <Link2 size={10} />{part}
            </button>
          );
        }
        if (/^https?:\/\//.test(part)) {
          return (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--link)', wordBreak: 'break-all', textDecoration: 'underline' }} onClick={(e) => e.stopPropagation()}>
              {part}
            </a>
          );
        }
        if (/^@[^\s@]{1,20}$/.test(part)) {
          return <span key={i} style={{ color: 'var(--owner)', fontWeight: 700 }}>{part}</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function BarRow({ label, count, max, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <div style={{ width: 64, fontSize: 10.5, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, background: 'var(--panel-alt)', borderRadius: 4, overflow: 'hidden', height: 12 }}>
        <div style={{ width: `${Math.max(4, (count / max) * 100)}%`, height: '100%', background: color || 'var(--owner)', borderRadius: 4 }} />
      </div>
      <div style={{ width: 26, fontSize: 10.5, color: 'var(--ink-strong)', fontWeight: 700, textAlign: 'right', flexShrink: 0 }}>{count}</div>
    </div>
  );
}

function StudioComments() {
  const [userId, setUserId] = useState('');
  const [nickname, setNickname] = useState('');
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameSet, setNicknameSet] = useState(false);
  const [nickReady, setNickReady] = useState(false);
  const [view, setView] = useState('lobby');
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomPrivate, setNewRoomPrivate] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [presence, setPresence] = useState([]);
  const [reads, setReads] = useState([]);
  const [expandedReads, setExpandedReads] = useState(() => new Set());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [dmPendingAttachment, setDmPendingAttachment] = useState(null);
  const [dmAttaching, setDmAttaching] = useState(false);
  const [dmAttachError, setDmAttachError] = useState('');
  const dmFileInputRef = useRef(null);
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState('');
  const [fileCache, setFileCache] = useState({});
  const [lightbox, setLightbox] = useState(null);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [inviteIdDraft, setInviteIdDraft] = useState('');
  const [profiles, setProfiles] = useState({});
  const [avatarCache, setAvatarCache] = useState({});
  const [roomThumbCache, setRoomThumbCache] = useState({});
  const [lobbyPresenceMap, setLobbyPresenceMap] = useState({});
  const [roomLastSeenMap, setRoomLastSeenMap] = useState({});
  const roomThumbFileInputRef = useRef(null);
  const [roomThumbUploading, setRoomThumbUploading] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileNicknameDraft, setProfileNicknameDraft] = useState('');
  const [profileIconDraft, setProfileIconDraft] = useState(null);
  const [profileColorDraft, setProfileColorDraft] = useState(AVATAR_COLORS[0]);
  const [profileBioDraft, setProfileBioDraft] = useState('');
  const [profileAvatarFileId, setProfileAvatarFileId] = useState(null);
  const [profileAvatarUploading, setProfileAvatarUploading] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logQuery, setLogQuery] = useState('');
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const [copiedMomentId, setCopiedMomentId] = useState(null);
  const [highlightMomentId, setHighlightMomentId] = useState(null);
  const [viewProfileTarget, setViewProfileTarget] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [symbolPickerOpen, setSymbolPickerOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  const [myStamps, setMyStamps] = useState([]);
  const [stampPickerOpen, setStampPickerOpen] = useState(false);
  const [stampUploading, setStampUploading] = useState(false);

  const [dmThreads, setDmThreads] = useState([]);
  const [dmThreadsLoading, setDmThreadsLoading] = useState(true);
  const [activeDmPeer, setActiveDmPeer] = useState(null);
  const [dmMessages, setDmMessages] = useState([]);
  const [dmReadMap, setDmReadMap] = useState({});
  const [dmPeerReadAt, setDmPeerReadAt] = useState(0);
  const [momentsLastSeen, setMomentsLastSeen] = useState(0);
  const [projectsLastSeen, setProjectsLastSeen] = useState(0);
  const [dmDraft, setDmDraft] = useState('');
  const [dmPeerTyping, setDmPeerTyping] = useState(false);
  const [projectChatTypingUsers, setProjectChatTypingUsers] = useState([]);
  const lastDmTypingSentRef = useRef(0);
  const lastProjectTypingSentRef = useRef(0);
  const [dmSending, setDmSending] = useState(false);
  const [dmStartIdInput, setDmStartIdInput] = useState('');
  const [dmMonitorThreads, setDmMonitorThreads] = useState([]);
  const [dmMonitorSelected, setDmMonitorSelected] = useState(null);
  const [dmMonitorMessages, setDmMonitorMessages] = useState([]);

  const [moments, setMoments] = useState([]);
  const [momentsLoading, setMomentsLoading] = useState(true);
  const [momentComposerOpen, setMomentComposerOpen] = useState(false);
  const [momentDraftText, setMomentDraftText] = useState('');
  const [momentDraftImage, setMomentDraftImage] = useState(null);
  const [momentPosting, setMomentPosting] = useState(false);

  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectComposerOpen, setProjectComposerOpen] = useState(false);
  const [projectTitleDraft, setProjectTitleDraft] = useState('');
  const [projectDescDraft, setProjectDescDraft] = useState('');
  const [projectImageDraft, setProjectImageDraft] = useState(null);
  const [projectImageUpdating, setProjectImageUpdating] = useState(false);
  const [editingProjectDesc, setEditingProjectDesc] = useState(false);
  const [projectDescEditDraft, setProjectDescEditDraft] = useState('');
  const projectImageEditInputRef = useRef(null);
  const [projectPosting, setProjectPosting] = useState(false);
  const [activeProject, setActiveProject] = useState(null);
  const [projectComments, setProjectComments] = useState([]);
  const [projectDetailTab, setProjectDetailTab] = useState('comments');
  const [projectChatMessages, setProjectChatMessages] = useState([]);
  const [projectChatDraft, setProjectChatDraft] = useState('');
  const [projectChatSending, setProjectChatSending] = useState(false);
  const projectChatPollRef = useRef(null);
  const projectChatEndRef = useRef(null);
  const [projectCommentDraft, setProjectCommentDraft] = useState('');
  const [projectCommentSending, setProjectCommentSending] = useState(false);

  const [callParticipants, setCallParticipants] = useState([]);
  const [inCall, setInCall] = useState(false);
  const [callConnecting, setCallConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [callError, setCallError] = useState('');
  const [remoteStreams, setRemoteStreams] = useState({});

  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [tabBarCompact, setTabBarCompact] = useState(false);
  const [globalPresence, setGlobalPresence] = useState([]);
  const [siteAdminUnlocked, setSiteAdminUnlocked] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');
  const [adminPassError, setAdminPassError] = useState('');

  const messagesEndRef = useRef(null);
  const messagesScrollRef = useRef(null);
  const handleMessagesScroll = () => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAutoScrollEnabled(distanceFromBottom < 80);
  };
  const roomsPollRef = useRef(null);
  const msgPollRef = useRef(null);
  const presencePollRef = useRef(null);
  const typingPollRef = useRef(null);
  const dmPollRef = useRef(null);
  const dmThreadsPollRef = useRef(null);
  const momentsPollRef = useRef(null);
  const projectsPollRef = useRef(null);
  const projectCommentsPollRef = useRef(null);
  const callSignalPollRef = useRef(null);
  const callStatePollRef = useRef(null);
  const fileInputRef = useRef(null);
  const avatarFileInputRef = useRef(null);
  const stampFileInputRef = useRef(null);
  const momentImageInputRef = useRef(null);
  const projectImageInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const fetchedFilesRef = useRef(new Set());
  const fetchedProfilesRef = useRef(new Set());
  const userIdRef = useRef('');
  const lastTypingSentRef = useRef(0);
  const pcRefs = useRef({});
  const localStreamRef = useRef(null);
  const processedSignalIdsRef = useRef(new Set());
  useEffect(() => { userIdRef.current = userId; }, [userId]);
  const nicknameRef = useRef('');
  useEffect(() => { nicknameRef.current = nickname; }, [nickname]);
  const siteAdminRef = useRef(false);
  useEffect(() => { siteAdminRef.current = siteAdminUnlocked; }, [siteAdminUnlocked]);

  useEffect(() => {
    (async () => {
      let myId = await safeGet(USERID_KEY, false);
      if (!myId) {
        myId = genUserId();
        await safeSet(USERID_KEY, myId, false);
      }
      setUserId(myId);
      const savedNick = await safeGet(NICK_KEY, false);
      if (savedNick) {
        setNickname(savedNick);
        setNicknameInput(savedNick);
        setNicknameSet(true);
      }
      const sraw = await safeGet(STAMP_PREFIX + myId, true);
      setMyStamps(parseList(sraw));
      setNickReady(true);
      try {
        if (window.localStorage.getItem('studio:site-admin') === '1') setSiteAdminUnlocked(true);
        const ms = window.localStorage.getItem('studio:lastseen:moments');
        if (ms) setMomentsLastSeen(Number(ms));
        const ps = window.localStorage.getItem('studio:lastseen:projects');
        if (ps) setProjectsLastSeen(Number(ps));
        const rs = window.localStorage.getItem('studio:lastseen:rooms');
        if (rs) { try { setRoomLastSeenMap(JSON.parse(rs)); } catch (e) {} }
      } catch (e) {}
    })();
  }, []);

  // 全体のオンライン状態（どのスタジオを見ていても自分の在室を知らせる）
  useEffect(() => {
    if (!nickReady || !userId) return;
    let cancelled = false;
    const beat = async () => {
      const raw = await safeGet(GLOBAL_PRESENCE_KEY, true);
      const cutoff = Date.now() - GLOBAL_PRESENCE_TTL;
      let list = parseList(raw).filter((p) => p.lastSeen >= cutoff && p.userId !== userId);
      list.push({ userId, nickname, lastSeen: Date.now() });
      if (cancelled) return;
      setGlobalPresence(list);
      await safeSet(GLOBAL_PRESENCE_KEY, JSON.stringify(list), true);
    };
    beat();
    const t = setInterval(beat, 8000);
    return () => { cancelled = true; clearInterval(t); };
  }, [nickReady, userId, nickname]);

  const isUserOnline = useCallback((uId) => {
    const cutoff = Date.now() - GLOBAL_PRESENCE_TTL;
    return globalPresence.some((p) => p.userId === uId && p.lastSeen >= cutoff);
  }, [globalPresence]);

  const unlockSiteAdmin = () => {
    if (adminPassInput === SITE_ADMIN_PASSPHRASE) {
      setSiteAdminUnlocked(true);
      setAdminPassError('');
      setAdminPassInput('');
      try { window.localStorage.setItem('studio:site-admin', '1'); } catch (e) {}
    } else {
      setAdminPassError('合言葉が違います');
    }
  };

  // ---- 通知（メンション・お知らせ） ----
  const addNotification = useCallback(async (targetUserId, entry) => {
    if (!targetUserId || targetUserId === userIdRef.current) return;
    const raw = await safeGet(NOTIF_PREFIX + targetUserId, true);
    let list = parseList(raw);
    list.unshift({ id: uid(), ts: Date.now(), ...entry });
    list = list.slice(0, 100);
    await safeSet(NOTIF_PREFIX + targetUserId, JSON.stringify(list), true);
  }, []);

  // ニックネーム→userId の対応（永続登録簿。@メンションの解決に使う）
  const nicknameDirectoryRef = useRef({});

  const registerNickname = useCallback(async (nick, uId) => {
    if (!nick || !uId) return;
    const raw = await safeGet(NICKNAME_REGISTRY_KEY, true);
    let map = {};
    try { map = raw ? JSON.parse(raw) : {}; } catch (e) { map = {}; }
    if (map[nick] === uId) return;
    map[nick] = uId;
    nicknameDirectoryRef.current[nick] = uId;
    await safeSet(NICKNAME_REGISTRY_KEY, JSON.stringify(map), true);
  }, []);

  const loadNicknameRegistry = useCallback(async () => {
    const raw = await safeGet(NICKNAME_REGISTRY_KEY, true);
    try {
      const map = raw ? JSON.parse(raw) : {};
      nicknameDirectoryRef.current = { ...nicknameDirectoryRef.current, ...map };
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!nicknameSet) return;
    loadNicknameRegistry();
    registerNickname(nickname, userId);
    const t = setInterval(loadNicknameRegistry, 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nicknameSet, nickname, userId]);

  useEffect(() => {
    const dir = nicknameDirectoryRef.current;
    globalPresence.forEach((p) => { dir[p.nickname] = p.userId; });
    messages.forEach((m) => { if (m.nickname) dir[m.nickname] = m.userId; });
  }, [globalPresence, messages]);

  const notifyMentions = useCallback(async (text, context) => {
    const names = extractMentions(text);
    if (names.length === 0) return;
    const dir = nicknameDirectoryRef.current;
    const isAllMention = names.some((n) => n.toLowerCase() === 'all');
    if (isAllMention) {
      let map = {};
      try {
        const raw = await safeGet(NICKNAME_REGISTRY_KEY, true);
        map = raw ? JSON.parse(raw) : {};
      } catch (e) { map = {}; }
      const targets = new Set([...Object.values(map), ...Object.values(dir)]);
      targets.forEach((targetId) => {
        if (targetId === userIdRef.current) return;
        addNotification(targetId, {
          type: 'mention',
          fromNickname: nicknameRef.current,
          text: text.slice(0, 60),
          isAll: true,
          ...context,
        });
      });
      return;
    }
    const seen = new Set();
    names.forEach((name) => {
      const targetId = dir[name];
      if (!targetId || seen.has(targetId)) return;
      seen.add(targetId);
      addNotification(targetId, {
        type: 'mention',
        fromNickname: nicknameRef.current,
        text: text.slice(0, 60),
        ...context,
      });
    });
  }, [addNotification]);

  const [notifications, setNotifications] = useState([]);
  const [notifLastSeen, setNotifLastSeen] = useState(0);
  const notifPollRef = useRef(null);

  const loadNotifications = useCallback(async () => {
    const raw = await safeGet(NOTIF_PREFIX + userIdRef.current, true);
    setNotifications(parseList(raw));
  }, []);

  useEffect(() => {
    if (!nicknameSet) return;
    loadNotifications();
    notifPollRef.current = setInterval(loadNotifications, 8000);
    try {
      const ls = window.localStorage.getItem('studio:lastseen:notif');
      if (ls) setNotifLastSeen(Number(ls));
    } catch (e) {}
    return () => clearInterval(notifPollRef.current);
  }, [nicknameSet, loadNotifications]);

  const notifUnreadCount = notifications.filter((n) => n.ts > notifLastSeen).length;

  const openNotifications = () => {
    setView('notifications');
    loadNotifications();
    const now = Date.now();
    setNotifLastSeen(now);
    try { window.localStorage.setItem('studio:lastseen:notif', String(now)); } catch (e) {}
  };

  const goToNotification = (n) => {
    if (n.type === 'mention' && n.roomId) {
      const r = rooms.find((rr) => rr.id === n.roomId);
      if (r) { enterRoom(r); return; }
    }
    if (n.type === 'mention' && n.projectId) {
      const p = projects.find((pp) => pp.id === n.projectId);
      if (p) { openProject(p); setProjectDetailTab('chat'); return; }
    }
    if (n.type === 'mention' && n.dmPeerId) {
      openDmWith(n.dmPeerId, n.fromNickname);
      return;
    }
  };

  // ---- 運営からのお知らせ ----
  const [announcement, setAnnouncement] = useState(null);
  const [announcementDraft, setAnnouncementDraft] = useState('');
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);

  const loadAnnouncement = useCallback(async () => {
    const raw = await safeGet(ANNOUNCEMENT_KEY, true);
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      setAnnouncement(parsed);
    } catch (e) { setAnnouncement(null); }
  }, []);

  useEffect(() => {
    if (!nicknameSet) return;
    loadAnnouncement();
    const t = setInterval(loadAnnouncement, 20000);
    try {
      const dismissedId = window.localStorage.getItem('studio:announcement-dismissed');
      if (dismissedId) setAnnouncementDismissed(dismissedId);
    } catch (e) {}
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nicknameSet]);

  const postAnnouncement = async () => {
    if (!siteAdminUnlocked || !announcementDraft.trim()) return;
    const entry = { id: uid(), text: announcementDraft.trim().slice(0, 300), ts: Date.now(), fromNickname: nickname };
    await safeSet(ANNOUNCEMENT_KEY, JSON.stringify(entry), true);
    setAnnouncement(entry);
    setAnnouncementDraft('');
  };

  const clearAnnouncement = async () => {
    if (!siteAdminUnlocked) return;
    await safeSet(ANNOUNCEMENT_KEY, JSON.stringify(null), true);
    setAnnouncement(null);
  };

  const dismissAnnouncement = () => {
    if (!announcement) return;
    setAnnouncementDismissed(announcement.id);
    try { window.localStorage.setItem('studio:announcement-dismissed', announcement.id); } catch (e) {}
  };

  const ensureProfiles = useCallback((ids) => {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    unique.forEach((id) => {
      if (fetchedProfilesRef.current.has(id)) return;
      fetchedProfilesRef.current.add(id);
      (async () => {
        const raw = await safeGet(PROFILE_PREFIX + id, true);
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          setProfiles((prev) => ({ ...prev, [id]: parsed }));
          if (parsed.avatarFileId) {
            const fraw = await safeGet(FILE_PREFIX + parsed.avatarFileId, true);
            if (fraw) {
              try {
                const fp = JSON.parse(fraw);
                setAvatarCache((prev) => ({ ...prev, [id]: fp.dataUrl }));
              } catch (e) { /* ignore malformed file */ }
            }
          }
        } catch (e) { /* ignore malformed profile */ }
      })();
    });
  }, []);

  useEffect(() => {
    if (userId) ensureProfiles([userId]);
  }, [userId, ensureProfiles]);

  const loadRooms = useCallback(async () => {
    const raw = await safeGet(ROOMS_KEY, true);
    setRooms(parseList(raw));
    setRoomsLoading(false);
  }, []);

  useEffect(() => {
    if (view !== 'lobby' || !nicknameSet) return;
    loadRooms();
    roomsPollRef.current = setInterval(loadRooms, 4000);
    return () => clearInterval(roomsPollRef.current);
  }, [view, nicknameSet, loadRooms]);

  const lastMessagesRawRef = useRef('');
  const loadMessages = useCallback(async (roomId) => {
    const raw = await safeGet(MSG_PREFIX + roomId, true);
    const rawStr = raw || '';
    if (rawStr === lastMessagesRawRef.current) return;
    lastMessagesRawRef.current = rawStr;
    setMessages(parseList(raw));
  }, []);

  const loadPresence = useCallback(async (roomId) => {
    const raw = await safeGet(PRESENCE_PREFIX + roomId, true);
    const list = parseList(raw);
    const cutoff = Date.now() - PRESENCE_TTL;
    setPresence(list.filter((p) => p.lastSeen >= cutoff));
  }, []);

  const loadReads = useCallback(async (roomId) => {
    const raw = await safeGet(READS_PREFIX + roomId, true);
    setReads(parseList(raw));
  }, []);

  const loadTyping = useCallback(async (roomId) => {
    const raw = await safeGet(TYPING_PREFIX + roomId, true);
    const list = parseList(raw);
    const cutoff = Date.now() - TYPING_TTL;
    setTypingUsers(list.filter((t) => t.lastTyping >= cutoff && t.userId !== userIdRef.current));
  }, []);

  const sendTypingBeat = useCallback(async (roomId, uId, nick) => {
    if (!uId) return;
    const raw = await safeGet(TYPING_PREFIX + roomId, true);
    let list = parseList(raw);
    const cutoff = Date.now() - TYPING_TTL * 2;
    list = list.filter((t) => t.userId !== uId && t.lastTyping >= cutoff);
    list.push({ userId: uId, nickname: nick, lastTyping: Date.now() });
    await safeSet(TYPING_PREFIX + roomId, JSON.stringify(list), true);
  }, []);

  const loadCallParticipants = useCallback(async (roomId) => {
    const state = parseObj(await safeGet(CALL_STATE_PREFIX + roomId, true), { participants: [] });
    const cutoff = Date.now() - CALL_TTL;
    const active = (state.participants || []).filter((p) => p.lastSeen >= cutoff);
    setCallParticipants(active);
    return active;
  }, []);

  const beat = useCallback(async (roomId, uId, nick) => {
    if (!uId) return;
    const raw = await safeGet(PRESENCE_PREFIX + roomId, true);
    let list = parseList(raw);
    const cutoff = Date.now() - PRESENCE_TTL * 2;
    list = list.filter((p) => p.userId !== uId && p.lastSeen >= cutoff);
    list.push({ userId: uId, nickname: nick, lastSeen: Date.now() });
    await safeSet(PRESENCE_PREFIX + roomId, JSON.stringify(list), true);
  }, []);

  const beatRead = useCallback(async (roomId, uId, nick) => {
    if (!uId) return;
    const raw = await safeGet(READS_PREFIX + roomId, true);
    let list = parseList(raw);
    list = list.filter((r) => r.userId !== uId);
    list.push({ userId: uId, nickname: nick, lastReadTs: Date.now() });
    await safeSet(READS_PREFIX + roomId, JSON.stringify(list), true);
  }, []);

  const loadRoomMeta = useCallback(async (roomId) => {
    const raw = await safeGet(ROOMS_KEY, true);
    const list = parseList(raw);
    const r = list.find((x) => x.id === roomId);
    if (!r) return;
    setCurrentRoom(r);
    if (!siteAdminRef.current && (isBannedId(r, userIdRef.current) || !canView(r, userIdRef.current))) {
      setView('lobby');
      setCurrentRoom(null);
      setError(isBannedId(r, userIdRef.current)
        ? 'このスタジオから追放されているため、コメントできません。'
        : 'このスタジオへのアクセス許可が取り消されました。');
    }
  }, []);

  useEffect(() => {
    if (view !== 'room' || !currentRoom) return;
    let cancelled = false;
    setMessagesLoading(true);
    (async () => {
      await loadMessages(currentRoom.id);
      if (cancelled) return;
      setMessagesLoading(false);
      await beat(currentRoom.id, userId, nickname);
      await loadPresence(currentRoom.id);
      await beatRead(currentRoom.id, userId, nickname);
      await loadReads(currentRoom.id);
      await loadTyping(currentRoom.id);
      await loadCallParticipants(currentRoom.id);
    })();
    msgPollRef.current = setInterval(() => loadMessages(currentRoom.id), 2500);
    presencePollRef.current = setInterval(async () => {
      await beat(currentRoom.id, userId, nickname);
      await loadPresence(currentRoom.id);
      await beatRead(currentRoom.id, userId, nickname);
      await loadReads(currentRoom.id);
      await loadRoomMeta(currentRoom.id);
      await loadCallParticipants(currentRoom.id);
    }, 5000);
    typingPollRef.current = setInterval(() => loadTyping(currentRoom.id), 2000);
    return () => {
      cancelled = true;
      clearInterval(msgPollRef.current);
      clearInterval(presencePollRef.current);
      clearInterval(typingPollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, currentRoom && currentRoom.id]);

  useEffect(() => {
    if (autoScrollEnabled) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, autoScrollEnabled]);

  useEffect(() => {
    messages.forEach((m) => {
      if (!m.attachment) return;
      const fileId = m.attachment.fileId;
      if (fetchedFilesRef.current.has(fileId)) return;
      fetchedFilesRef.current.add(fileId);
      (async () => {
        const raw = await safeGet(FILE_PREFIX + fileId, true);
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          setFileCache((prev) => ({ ...prev, [fileId]: parsed.dataUrl }));
        } catch (e) { /* ignore malformed file entry */ }
      })();
    });
  }, [messages]);

  useEffect(() => {
    dmMessages.forEach((m) => {
      if (!m.attachment) return;
      const fileId = m.attachment.fileId;
      if (fetchedFilesRef.current.has(fileId)) return;
      fetchedFilesRef.current.add(fileId);
      (async () => {
        const raw = await safeGet(FILE_PREFIX + fileId, true);
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          setFileCache((prev) => ({ ...prev, [fileId]: parsed.dataUrl }));
        } catch (e) { /* ignore malformed file entry */ }
      })();
    });
  }, [dmMessages]);

  useEffect(() => {
    moments.forEach((m) => {
      if (!m.imageFileId || fetchedFilesRef.current.has(m.imageFileId)) return;
      fetchedFilesRef.current.add(m.imageFileId);
      (async () => {
        const raw = await safeGet(FILE_PREFIX + m.imageFileId, true);
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          setFileCache((prev) => ({ ...prev, [m.imageFileId]: parsed.dataUrl }));
        } catch (e) { /* ignore */ }
      })();
    });
  }, [moments]);

  useEffect(() => {
    projects.forEach((p) => {
      if (!p.imageFileId || fetchedFilesRef.current.has(p.imageFileId)) return;
      fetchedFilesRef.current.add(p.imageFileId);
      (async () => {
        const raw = await safeGet(FILE_PREFIX + p.imageFileId, true);
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          setFileCache((prev) => ({ ...prev, [p.imageFileId]: parsed.dataUrl }));
        } catch (e) { /* ignore */ }
      })();
    });
  }, [projects]);

  useEffect(() => {
    const ids = [
      ...messages.map((m) => m.userId),
      ...presence.map((p) => p.userId),
      ...reads.map((r) => r.userId),
      ...typingUsers.map((t) => t.userId),
      ...moments.map((m) => m.userId),
      ...projects.map((p) => p.authorId),
      ...projectComments.map((c) => c.userId),
      ...dmThreads.map((t) => t.peerId),
      ...dmMessages.map((m) => m.fromId),
    ];
    if (ids.length) ensureProfiles(ids);
  }, [messages, presence, reads, typingUsers, moments, projects, projectComments, dmThreads, dmMessages, ensureProfiles]);

  const isAdmin = !!(siteAdminUnlocked || (currentRoom && userId && currentRoom.ownerId === userId));

  const startReply = (m) => {
    const snippetSource = m.text || (m.attachment ? (m.attachment.kind === 'image' ? '［画像］' : m.attachment.kind === 'stamp' ? '［スタンプ］' : `［${m.attachment.name}］`) : '');
    setReplyTo({ id: m.id, nickname: m.nickname, text: snippetSource.slice(0, 60) });
    messageInputRef.current?.focus();
  };

  const scrollToMessage = (id) => {
    const el = document.getElementById(`sc-msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightId(id);
      setTimeout(() => setHighlightId(null), 1200);
    } else {
      setError('このIDのメッセージは表示範囲内に見つかりませんでした。');
      setTimeout(() => setError(''), 2500);
    }
  };

  const toggleReadExpand = (id) => {
    setExpandedReads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const copyMsgId = async (id) => {
    try {
      await navigator.clipboard.writeText(`#msg:${id}`);
      setCopiedMsgId(id);
      setTimeout(() => setCopiedMsgId(null), 1500);
    } catch (e) { /* clipboard unavailable */ }
  };

  const copyMomentLink = async (id) => {
    try {
      const url = `${window.location.origin}${window.location.pathname}?post=moment:${id}`;
      await navigator.clipboard.writeText(url);
      setCopiedMomentId(id);
      setTimeout(() => setCopiedMomentId(null), 1500);
    } catch (e) { /* clipboard unavailable */ }
  };

  const onPickFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setAttachError('');
    if (file.size > MAX_ORIGINAL_BYTES) {
      setAttachError('ファイルが大きすぎます（8MB以下にしてください）');
      return;
    }
    setAttaching(true);
    try {
      const isCompressible = file.type.startsWith('image/') && file.type !== 'image/gif';
      if (isCompressible) {
        const { dataUrl, width, height } = await compressImage(file);
        setPendingAttachment({
          name: file.name, mimeType: 'image/jpeg', dataUrl, kind: 'image',
          size: approxBytesFromDataUrl(dataUrl), width, height,
        });
      } else {
        if (file.size > MAX_NONIMAGE_BYTES) {
          setAttachError('この形式のファイルは1.5MB以下にしてください');
          setAttaching(false);
          return;
        }
        const dataUrl = await readAsDataURL(file);
        const kind = file.type.startsWith('image/') ? 'image' : 'file';
        setPendingAttachment({ name: file.name, mimeType: file.type || 'application/octet-stream', dataUrl, kind, size: file.size });
      }
    } catch (err) {
      setAttachError('ファイルを読み込めませんでした。');
    }
    setAttaching(false);
  };

  const onPickDmFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setDmAttachError('');
    if (file.size > MAX_ORIGINAL_BYTES) {
      setDmAttachError('ファイルが大きすぎます（8MB以下にしてください）');
      return;
    }
    setDmAttaching(true);
    try {
      const isCompressible = file.type.startsWith('image/') && file.type !== 'image/gif';
      if (isCompressible) {
        const { dataUrl, width, height } = await compressImage(file);
        setDmPendingAttachment({
          name: file.name, mimeType: 'image/jpeg', dataUrl, kind: 'image',
          size: approxBytesFromDataUrl(dataUrl), width, height,
        });
      } else {
        if (file.size > MAX_NONIMAGE_BYTES) {
          setDmAttachError('この形式のファイルは1.5MB以下にしてください');
          setDmAttaching(false);
          return;
        }
        const dataUrl = await readAsDataURL(file);
        const kind = file.type.startsWith('image/') ? 'image' : 'file';
        setDmPendingAttachment({ name: file.name, mimeType: file.type || 'application/octet-stream', dataUrl, kind, size: file.size });
      }
    } catch (err) {
      setDmAttachError('ファイルを読み込めませんでした。');
    }
    setDmAttaching(false);
  };

  const confirmNickname = async () => {
    const trimmed = nicknameInput.trim().slice(0, 16);
    if (!trimmed) return;
    setNickname(trimmed);
    setNicknameSet(true);
    await safeSet(NICK_KEY, trimmed, false);
  };

  const openProfileModal = () => {
    const p = profiles[userId] || {};
    setProfileNicknameDraft(nickname);
    setProfileIconDraft(p.icon || null);
    setProfileColorDraft(p.color || avatarColor(nickname));
    setProfileBioDraft(p.bio || '');
    setProfileAvatarFileId(p.avatarFileId || null);
    setIdCopied(false);
    setProfileModalOpen(true);
  };

  const onPickAvatarFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setProfileAvatarUploading(true);
    try {
      const { dataUrl } = await compressImage(file, 240, 0.82);
      const fileId = uid();
      await safeSet(FILE_PREFIX + fileId, JSON.stringify({ name: 'avatar', mimeType: 'image/jpeg', dataUrl }), true);
      setProfileAvatarFileId(fileId);
      setProfileIconDraft(null);
      setAvatarCache((prev) => ({ ...prev, [userId]: dataUrl }));
    } catch (err) {
      setError('アイコン画像を読み込めませんでした。');
    }
    setProfileAvatarUploading(false);
  };

  const saveProfileChanges = async () => {
    const trimmedNick = profileNicknameDraft.trim().slice(0, 16) || nickname;
    setNickname(trimmedNick);
    await safeSet(NICK_KEY, trimmedNick, false);
    registerNickname(trimmedNick, userId);
    const newProfile = {
      icon: profileIconDraft, color: profileColorDraft,
      bio: profileBioDraft.trim().slice(0, BIO_MAX_LEN),
      avatarFileId: profileAvatarFileId, updatedAt: Date.now(),
    };
    await safeSet(PROFILE_PREFIX + userId, JSON.stringify(newProfile), true);
    setProfiles((prev) => ({ ...prev, [userId]: newProfile }));
    setProfileModalOpen(false);
  };

  const copyMyId = async () => {
    try {
      await navigator.clipboard.writeText(userId);
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 1800);
    } catch (e) { /* clipboard unavailable; ignore */ }
  };

  const createRoom = async () => {
    const trimmed = newRoomName.trim().slice(0, 24);
    if (!trimmed || creatingRoom) return;
    setCreatingRoom(true);
    setError('');
    const raw = await safeGet(ROOMS_KEY, true);
    let list = parseList(raw);
    const room = {
      id: uid(), name: trimmed, createdAt: Date.now(), messageCount: 0, lastActivity: Date.now(),
      ownerId: userId, ownerNickname: nickname,
      private: newRoomPrivate, allowedUserIds: [], bannedUserIds: [],
    };
    list.unshift(room);
    list = list.slice(0, 300);
    const ok = await safeSet(ROOMS_KEY, JSON.stringify(list), true);
    setCreatingRoom(false);
    if (ok) {
      setRooms(list);
      setNewRoomName('');
      setNewRoomPrivate(false);
      enterRoom(room);
    } else {
      setError('スタジオを作れませんでした。もう一度お試しください。');
    }
  };

  const enterRoom = (room) => {
    if (!siteAdminUnlocked && isBannedId(room, userId)) {
      setError('このスタジオから追放されているため、入ることができません。');
      return;
    }
    if (!canView(room, userId)) {
      setError('このスタジオは非公開です。管理者に個人IDを伝えて招待してもらってください。');
      return;
    }
    setError('');
    setCurrentRoom(room);
    setRoomLastSeenMap((prev) => {
      const next = { ...prev, [room.id]: Date.now() };
      try { window.localStorage.setItem('studio:lastseen:rooms', JSON.stringify(next)); } catch (e) {}
      return next;
    });
    lastMessagesRawRef.current = '';
    setMessages([]);
    setPresence([]);
    setReads([]);
    setTypingUsers([]);
    setReplyTo(null);
    setPendingAttachment(null);
    setAttachError('');
    setAdminPanelOpen(false);
    setLogsOpen(false);
    setLogQuery('');
    setAnalyticsOpen(false);
    setStampPickerOpen(false);
    setSymbolPickerOpen(false);
    setView('room');
  };

  const leaveRoom = () => {
    if (inCall) leaveCall();
    setCurrentRoom(null);
    setDraft('');
    setReplyTo(null);
    setPendingAttachment(null);
    setAttachError('');
    setLightbox(null);
    setAdminPanelOpen(false);
    setLogsOpen(false);
    setAnalyticsOpen(false);
    setView('lobby');
  };

  const sendMessage = async () => {
    const text = draft.trim();
    if ((!text && !pendingAttachment) || !currentRoom || sending) return;
    if (!siteAdminUnlocked && (isBannedId(currentRoom, userId) || !canView(currentRoom, userId))) {
      setError('この操作は許可されていません。');
      return;
    }
    setSending(true);
    setError('');

    let attachmentRef = null;
    if (pendingAttachment) {
      const fileId = uid();
      const ok2 = await safeSet(
        FILE_PREFIX + fileId,
        JSON.stringify({ name: pendingAttachment.name, mimeType: pendingAttachment.mimeType, dataUrl: pendingAttachment.dataUrl }),
        true
      );
      if (!ok2) {
        setError('添付ファイルの送信に失敗しました。');
        setSending(false);
        return;
      }
      attachmentRef = {
        fileId, name: pendingAttachment.name, mimeType: pendingAttachment.mimeType,
        kind: pendingAttachment.kind, size: pendingAttachment.size,
        width: pendingAttachment.width, height: pendingAttachment.height,
      };
      fetchedFilesRef.current.add(fileId);
      setFileCache((prev) => ({ ...prev, [fileId]: pendingAttachment.dataUrl }));
    }

    const raw = await safeGet(MSG_PREFIX + currentRoom.id, true);
    let list = parseList(raw);
    const msg = {
      id: uid(), userId, nickname, text: text.slice(0, COMMENT_MAX_LEN), ts: Date.now(),
      attachment: attachmentRef, deleted: false,
      reply: replyTo ? { id: replyTo.id, nickname: replyTo.nickname, text: replyTo.text } : null,
    };
    list.push(msg);
    if (list.length > MAX_MESSAGES) list = list.slice(list.length - MAX_MESSAGES);
    const ok = await safeSet(MSG_PREFIX + currentRoom.id, JSON.stringify(list), true);
    if (ok) {
      setMessages(list);
      setDraft('');
      setPendingAttachment(null);
      setReplyTo(null);
      await beatRead(currentRoom.id, userId, nickname);
      const rawRooms = await safeGet(ROOMS_KEY, true);
      let rlist = parseList(rawRooms);
      rlist = rlist.map((r) => (r.id === currentRoom.id ? { ...r, messageCount: list.length, lastActivity: msg.ts, lastSenderId: userId } : r));
      await safeSet(ROOMS_KEY, JSON.stringify(rlist), true);
      notifyMentions(text, { roomId: currentRoom.id, roomName: currentRoom.name });
    } else {
      setError('投稿に失敗しました。もう一度お試しください。');
    }
    setSending(false);
  };

  const sendStamp = async (stamp) => {
    if (!currentRoom || sending) return;
    if (!siteAdminUnlocked && (isBannedId(currentRoom, userId) || !canView(currentRoom, userId))) return;
    setSending(true);
    const raw = await safeGet(MSG_PREFIX + currentRoom.id, true);
    let list = parseList(raw);
    const msg = {
      id: uid(), userId, nickname, text: '', ts: Date.now(),
      attachment: { fileId: stamp.fileId, name: 'スタンプ', mimeType: 'image/jpeg', kind: 'stamp', size: 0 },
      deleted: false, reply: replyTo ? { id: replyTo.id, nickname: replyTo.nickname, text: replyTo.text } : null,
    };
    list.push(msg);
    if (list.length > MAX_MESSAGES) list = list.slice(list.length - MAX_MESSAGES);
    const ok = await safeSet(MSG_PREFIX + currentRoom.id, JSON.stringify(list), true);
    if (ok) {
      setMessages(list);
      setReplyTo(null);
      setStampPickerOpen(false);
      const rawRooms = await safeGet(ROOMS_KEY, true);
      let rlist = parseList(rawRooms);
      rlist = rlist.map((r) => (r.id === currentRoom.id ? { ...r, messageCount: list.length, lastActivity: msg.ts, lastSenderId: userId } : r));
      await safeSet(ROOMS_KEY, JSON.stringify(rlist), true);
    }
    setSending(false);
  };

  const onDraftChange = (e) => {
    setDraft(e.target.value);
    if (!currentRoom) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current > 1500) {
      lastTypingSentRef.current = now;
      sendTypingBeat(currentRoom.id, userId, nickname);
    }
  };

  const insertSymbol = (sym) => {
    setDraft((prev) => prev + sym);
    messageInputRef.current?.focus();
  };

  const deleteMessage = async (msg) => {
    if (!currentRoom) return;
    const canDelete = isAdmin || msg.userId === userId;
    if (!canDelete || msg.deleted) return;
    const raw = await safeGet(MSG_PREFIX + currentRoom.id, true);
    let list = parseList(raw);
    list = list.map((m) => (m.id === msg.id ? { ...m, deleted: true, text: '', attachment: null } : m));
    const ok = await safeSet(MSG_PREFIX + currentRoom.id, JSON.stringify(list), true);
    if (ok) setMessages(list);
  };

  const updateRoomField = async (updater) => {
    if (!currentRoom) return null;
    const raw = await safeGet(ROOMS_KEY, true);
    let list = parseList(raw);
    list = list.map((r) => (r.id === currentRoom.id ? updater(r) : r));
    const ok = await safeSet(ROOMS_KEY, JSON.stringify(list), true);
    if (ok) {
      const updated = list.find((r) => r.id === currentRoom.id);
      setCurrentRoom(updated);
      return updated;
    }
    return null;
  };

  const deleteRoom = async () => {
    if (!currentRoom || !isAdmin) return;
    if (!window.confirm(`「${currentRoom.name}」を削除します。よろしいですか？（元に戻せません）`)) return;
    const raw = await safeGet(ROOMS_KEY, true);
    const list = parseList(raw).filter((r) => r.id !== currentRoom.id);
    const ok = await safeSet(ROOMS_KEY, JSON.stringify(list), true);
    if (ok) {
      setRooms(list);
      setCurrentRoom(null);
      setAdminPanelOpen(false);
      setView('lobby');
    }
  };

  const banUser = async (targetId) => {
    if (!isAdmin || !currentRoom || targetId === userId) return;
    const updated = await updateRoomField((r) => ({
      ...r,
      bannedUserIds: Array.from(new Set([...(r.bannedUserIds || []), targetId])),
      allowedUserIds: (r.allowedUserIds || []).filter((id) => id !== targetId),
    }));
    if (updated) {
      const praw = await safeGet(PRESENCE_PREFIX + currentRoom.id, true);
      const plist = parseList(praw).filter((p) => p.userId !== targetId);
      await safeSet(PRESENCE_PREFIX + currentRoom.id, JSON.stringify(plist), true);
      setPresence(plist);
    }
  };

  const unbanUser = async (targetId) => {
    if (!isAdmin || !currentRoom) return;
    await updateRoomField((r) => ({ ...r, bannedUserIds: (r.bannedUserIds || []).filter((id) => id !== targetId) }));
  };

  const addAllowedMember = async (targetId) => {
    const cleaned = (targetId || '').trim().toUpperCase();
    if (!isAdmin || !currentRoom || !cleaned || cleaned === currentRoom.ownerId) return;
    await updateRoomField((r) => ({
      ...r,
      allowedUserIds: Array.from(new Set([...(r.allowedUserIds || []), cleaned])),
      bannedUserIds: (r.bannedUserIds || []).filter((id) => id !== cleaned),
    }));
    setInviteIdDraft('');
  };

  const removeAllowedMember = async (targetId) => {
    if (!isAdmin || !currentRoom) return;
    await updateRoomField((r) => ({ ...r, allowedUserIds: (r.allowedUserIds || []).filter((id) => id !== targetId) }));
  };

  // ---- stamps ----
  const onPickStampFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (myStamps.length >= MAX_STAMPS) {
      setError(`スタンプは${MAX_STAMPS}個まで作成できます。`);
      return;
    }
    setStampUploading(true);
    try {
      const { dataUrl } = await compressImage(file, 300, 0.85);
      const fileId = uid();
      await safeSet(FILE_PREFIX + fileId, JSON.stringify({ name: 'stamp', mimeType: 'image/jpeg', dataUrl }), true);
      const raw = await safeGet(STAMP_PREFIX + userId, true);
      let list = parseList(raw);
      list.push({ id: uid(), fileId, createdAt: Date.now() });
      await safeSet(STAMP_PREFIX + userId, JSON.stringify(list), true);
      setMyStamps(list);
      fetchedFilesRef.current.add(fileId);
      setFileCache((prev) => ({ ...prev, [fileId]: dataUrl }));
    } catch (err) {
      setError('スタンプの作成に失敗しました。');
    }
    setStampUploading(false);
  };

  const deleteStamp = async (stampId) => {
    const raw = await safeGet(STAMP_PREFIX + userId, true);
    let list = parseList(raw).filter((s) => s.id !== stampId);
    await safeSet(STAMP_PREFIX + userId, JSON.stringify(list), true);
    setMyStamps(list);
  };

  // ---- DM ----
  const loadDmThreads = useCallback(async () => {
    setDmThreadsLoading(true);
    const raw = await safeGet(DM_INDEX_KEY, true);
    const list = parseList(raw);
    const mine = list
      .filter((t) => t.userA === userIdRef.current || t.userB === userIdRef.current)
      .map((t) => {
        const peerId = t.userA === userIdRef.current ? t.userB : t.userA;
        const peerNickname = t.userA === userIdRef.current ? t.nicknameB : t.nicknameA;
        return { peerId, peerNickname, lastMessage: t.lastMessage, lastTs: t.lastTs, lastSenderId: t.lastSenderId };
      })
      .sort((a, b) => b.lastTs - a.lastTs);
    setDmThreads(mine);
    setDmThreadsLoading(false);
    const mraw = await safeGet(DM_READS_PREFIX + userIdRef.current, true);
    try { setDmReadMap(mraw ? JSON.parse(mraw) : {}); } catch (e) { setDmReadMap({}); }
  }, []);

  const dmUnreadCount = dmThreads.filter((t) => t.lastSenderId && t.lastSenderId !== userId && t.lastTs > (dmReadMap[dmKey(userId, t.peerId)] || 0)).length;

  useEffect(() => {
    if (!nicknameSet) return;
    loadDmThreads();
    const t = setInterval(loadDmThreads, 15000);
    return () => clearInterval(t);
  }, [nicknameSet, loadDmThreads]);

  useEffect(() => {
    if (view !== 'dm-list' || !nicknameSet) return;
    loadDmThreads();
    dmThreadsPollRef.current = setInterval(loadDmThreads, 4000);
    return () => clearInterval(dmThreadsPollRef.current);
  }, [view, nicknameSet, loadDmThreads]);

  const markDmRead = useCallback(async (peerId) => {
    const uidNow = userIdRef.current;
    const pairKey = dmKey(uidNow, peerId);
    const raw = await safeGet(DM_READS_PREFIX + uidNow, true);
    let map = {};
    try { map = raw ? JSON.parse(raw) : {}; } catch (e) { map = {}; }
    map[pairKey] = Date.now();
    setDmReadMap(map);
    await safeSet(DM_READS_PREFIX + uidNow, JSON.stringify(map), true);
  }, []);

  const loadDmMessages = useCallback(async (peerId) => {
    const pairKey = dmKey(userIdRef.current, peerId);
    const raw = await safeGet(DM_PREFIX + pairKey, true);
    const list = parseList(raw);
    setDmMessages(list);
    const fromPeer = [...list].reverse().find((m) => m.fromId === peerId);
    if (fromPeer) {
      setActiveDmPeer((prev) => (prev && prev.userId === peerId ? { ...prev, nickname: fromPeer.fromNickname } : prev));
    }
    markDmRead(peerId);
    const praw = await safeGet(DM_READS_PREFIX + peerId, true);
    try {
      const pmap = praw ? JSON.parse(praw) : {};
      setDmPeerReadAt(pmap[pairKey] || 0);
    } catch (e) { setDmPeerReadAt(0); }
    const traw = await safeGet(TYPING_PREFIX + 'dm:' + pairKey, true);
    const tlist = parseList(traw);
    const cutoff = Date.now() - TYPING_TTL;
    setDmPeerTyping(tlist.some((t) => t.userId === peerId && t.lastTyping >= cutoff));
  }, [markDmRead]);

  const openDmWith = (peerId, peerNickname) => {
    if (!peerId || peerId === userId) {
      setError('自分自身にはDMを送れません。');
      return;
    }
    setError('');
    setActiveDmPeer({ userId: peerId, nickname: peerNickname || peerId });
    setDmMessages([]);
    setDmPeerReadAt(0);
    setDmPendingAttachment(null);
    setDmAttachError('');
    setView('dm-thread');
    loadDmMessages(peerId);
  };

  useEffect(() => {
    if (view !== 'dm-thread' || !activeDmPeer) return;
    dmPollRef.current = setInterval(() => loadDmMessages(activeDmPeer.userId), 2500);
    return () => clearInterval(dmPollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, activeDmPeer && activeDmPeer.userId]);

  const sendDm = async () => {
    const text = dmDraft.trim();
    if ((!text && !dmPendingAttachment) || !activeDmPeer || dmSending) return;
    setDmSending(true);

    let attachmentRef = null;
    if (dmPendingAttachment) {
      const fileId = uid();
      const ok2 = await safeSet(
        FILE_PREFIX + fileId,
        JSON.stringify({ name: dmPendingAttachment.name, mimeType: dmPendingAttachment.mimeType, dataUrl: dmPendingAttachment.dataUrl }),
        true
      );
      if (!ok2) {
        setDmAttachError('添付ファイルの送信に失敗しました。');
        setDmSending(false);
        return;
      }
      attachmentRef = {
        fileId, name: dmPendingAttachment.name, mimeType: dmPendingAttachment.mimeType,
        kind: dmPendingAttachment.kind, size: dmPendingAttachment.size,
        width: dmPendingAttachment.width, height: dmPendingAttachment.height,
      };
      fetchedFilesRef.current.add(fileId);
      setFileCache((prev) => ({ ...prev, [fileId]: dmPendingAttachment.dataUrl }));
    }

    const pairKey = dmKey(userId, activeDmPeer.userId);
    const raw = await safeGet(DM_PREFIX + pairKey, true);
    let list = parseList(raw);
    const msg = { id: uid(), fromId: userId, fromNickname: nickname, text: text.slice(0, COMMENT_MAX_LEN), ts: Date.now(), attachment: attachmentRef };
    list.push(msg);
    if (list.length > MAX_MESSAGES) list = list.slice(list.length - MAX_MESSAGES);
    const ok = await safeSet(DM_PREFIX + pairKey, JSON.stringify(list), true);
    if (ok) {
      setDmMessages(list);
      setDmDraft('');
      setDmPendingAttachment(null);
      const idxRaw = await safeGet(DM_INDEX_KEY, true);
      let idxList = parseList(idxRaw);
      const [a, b] = [userId, activeDmPeer.userId].sort();
      const entry = {
        pairKey, userA: a, userB: b,
        nicknameA: a === userId ? nickname : activeDmPeer.nickname,
        nicknameB: b === userId ? nickname : activeDmPeer.nickname,
        lastMessage: text ? text.slice(0, 40) : (attachmentRef ? `［${attachmentRef.kind === 'image' ? '画像' : attachmentRef.name}］` : ''), lastTs: msg.ts, lastSenderId: userId,
      };
      const exists = idxList.some((t) => t.pairKey === pairKey);
      idxList = exists ? idxList.map((t) => (t.pairKey === pairKey ? entry : t)) : [...idxList, entry];
      idxList.sort((x, y) => y.lastTs - x.lastTs);
      idxList = idxList.slice(0, 300);
      await safeSet(DM_INDEX_KEY, JSON.stringify(idxList), true);
      markDmRead(activeDmPeer.userId);
    }
    setDmSending(false);
  };

  const startDmById = () => {
    const cleaned = dmStartIdInput.trim().toUpperCase();
    if (!cleaned) return;
    openDmWith(cleaned, profiles[cleaned] ? nickname : cleaned);
    setDmStartIdInput('');
  };

  const openDmMonitor = async () => {
    const raw = await safeGet(DM_INDEX_KEY, true);
    setDmMonitorThreads(parseList(raw).sort((a, b) => b.lastTs - a.lastTs));
    setDmMonitorSelected(null);
    setDmMonitorMessages([]);
    setAdminPanelOpen(false);
    setView('dm-monitor');
  };

  const openDmMonitorThread = async (thread) => {
    setDmMonitorSelected(thread);
    const raw = await safeGet(DM_PREFIX + thread.pairKey, true);
    setDmMonitorMessages(parseList(raw));
  };

  // ---- moments (mini SNS) ----
  const loadMoments = useCallback(async () => {
    const raw = await safeGet(MOMENTS_KEY, true);
    setMoments(parseList(raw));
    setMomentsLoading(false);
  }, []);

  useEffect(() => {
    if (!nicknameSet) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const post = params.get('post');
      if (post && post.startsWith('moment:')) {
        const id = post.slice('moment:'.length);
        setHighlightMomentId(id);
        setView('moments');
      }
    } catch (e) { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nicknameSet]);

  useEffect(() => {
    if (!highlightMomentId || moments.length === 0) return;
    const el = document.getElementById(`moment-${highlightMomentId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const t = setTimeout(() => setHighlightMomentId(null), 2500);
      return () => clearTimeout(t);
    }
  }, [moments, highlightMomentId]);

  useEffect(() => {
    if (view !== 'moments' || !nicknameSet) return;
    loadMoments();
    momentsPollRef.current = setInterval(loadMoments, 5000);
    return () => clearInterval(momentsPollRef.current);
  }, [view, nicknameSet, loadMoments]);

  const onPickMomentImage = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { dataUrl } = await compressImage(file, 720, 0.75);
      setMomentDraftImage({ dataUrl });
    } catch (err) {
      setError('画像を読み込めませんでした。');
    }
  };

  const postMoment = async () => {
    const text = momentDraftText.trim();
    if ((!text && !momentDraftImage) || momentPosting) return;
    setMomentPosting(true);
    let imageFileId = null;
    if (momentDraftImage) {
      imageFileId = uid();
      await safeSet(FILE_PREFIX + imageFileId, JSON.stringify({ name: 'moment', mimeType: 'image/jpeg', dataUrl: momentDraftImage.dataUrl }), true);
    }
    const raw = await safeGet(MOMENTS_KEY, true);
    let list = parseList(raw);
    const post = { id: uid(), userId, nickname, text: text.slice(0, MOMENT_MAX_LEN), imageFileId, ts: Date.now() };
    list.unshift(post);
    list = list.slice(0, MAX_MOMENTS);
    const ok = await safeSet(MOMENTS_KEY, JSON.stringify(list), true);
    if (ok) {
      setMoments(list);
      if (imageFileId) {
        fetchedFilesRef.current.add(imageFileId);
        setFileCache((prev) => ({ ...prev, [imageFileId]: momentDraftImage.dataUrl }));
      }
      setMomentDraftText('');
      setMomentDraftImage(null);
      setMomentComposerOpen(false);
    }
    setMomentPosting(false);
  };

  const deleteMoment = async (id) => {
    const m = moments.find((x) => x.id === id);
    if (!m || (m.userId !== userId && !siteAdminUnlocked)) return;
    const raw = await safeGet(MOMENTS_KEY, true);
    const list = parseList(raw).filter((x) => x.id !== id);
    const ok = await safeSet(MOMENTS_KEY, JSON.stringify(list), true);
    if (ok) setMoments(list);
  };

  // ---- projects ----
  const loadProjects = useCallback(async () => {
    const raw = await safeGet(PROJECTS_KEY, true);
    setProjects(parseList(raw));
    setProjectsLoading(false);
  }, []);

  useEffect(() => {
    if (view !== 'projects' || !nicknameSet) return;
    loadProjects();
    projectsPollRef.current = setInterval(loadProjects, 5000);
    return () => clearInterval(projectsPollRef.current);
  }, [view, nicknameSet, loadProjects]);

  const onPickProjectImage = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { dataUrl } = await compressImage(file, 800, 0.78);
      setProjectImageDraft({ dataUrl });
    } catch (err) {
      setError('画像を読み込めませんでした。');
    }
  };

  const updateProjectDescription = async (project, newDesc) => {
    if (!project || (project.authorId !== userId && !siteAdminUnlocked)) return;
    const raw = await safeGet(PROJECTS_KEY, true);
    const list = parseList(raw).map((p) => (p.id === project.id ? { ...p, description: newDesc } : p));
    const ok = await safeSet(PROJECTS_KEY, JSON.stringify(list), true);
    if (ok) {
      setProjects(list);
      setActiveProject((prev) => (prev && prev.id === project.id ? { ...prev, description: newDesc } : prev));
    }
    return ok;
  };

  const updateProjectImage = async (project, dataUrl) => {
    if (!project || (project.authorId !== userId && !siteAdminUnlocked)) return;
    setProjectImageUpdating(true);
    const imageFileId = uid();
    await safeSet(FILE_PREFIX + imageFileId, JSON.stringify({ name: 'project', mimeType: 'image/jpeg', dataUrl }), true);
    const raw = await safeGet(PROJECTS_KEY, true);
    const list = parseList(raw).map((p) => (p.id === project.id ? { ...p, imageFileId } : p));
    const ok = await safeSet(PROJECTS_KEY, JSON.stringify(list), true);
    if (ok) {
      setProjects(list);
      setActiveProject((prev) => (prev && prev.id === project.id ? { ...prev, imageFileId } : prev));
      fetchedFilesRef.current.add(imageFileId);
      setFileCache((prev) => ({ ...prev, [imageFileId]: dataUrl }));
    }
    setProjectImageUpdating(false);
  };

  const onPickProjectImageEdit = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || !activeProject) return;
    try {
      const { dataUrl } = await compressImage(file, 900, 0.82);
      await updateProjectImage(activeProject, dataUrl);
    } catch (err) {
      setError('画像を読み込めませんでした。');
    }
  };

  const postProject = async () => {
    const title = projectTitleDraft.trim().slice(0, 40);
    if (!title || !projectImageDraft || projectPosting) return;
    setProjectPosting(true);
    const imageFileId = uid();
    await safeSet(FILE_PREFIX + imageFileId, JSON.stringify({ name: 'project', mimeType: 'image/jpeg', dataUrl: projectImageDraft.dataUrl }), true);
    const raw = await safeGet(PROJECTS_KEY, true);
    let list = parseList(raw);
    const project = {
      id: uid(), title, description: projectDescDraft.trim().slice(0, 400), imageFileId,
      authorId: userId, authorNickname: nickname, ts: Date.now(), commentCount: 0,
    };
    list.unshift(project);
    list = list.slice(0, MAX_PROJECTS);
    const ok = await safeSet(PROJECTS_KEY, JSON.stringify(list), true);
    if (ok) {
      setProjects(list);
      fetchedFilesRef.current.add(imageFileId);
      setFileCache((prev) => ({ ...prev, [imageFileId]: projectImageDraft.dataUrl }));
      setProjectTitleDraft('');
      setProjectDescDraft('');
      setProjectImageDraft(null);
      setProjectComposerOpen(false);
    }
    setProjectPosting(false);
  };

  const deleteProject = async (id) => {
    const p = projects.find((x) => x.id === id);
    if (!p || (p.authorId !== userId && !siteAdminUnlocked)) return;
    const raw = await safeGet(PROJECTS_KEY, true);
    const list = parseList(raw).filter((x) => x.id !== id);
    const ok = await safeSet(PROJECTS_KEY, JSON.stringify(list), true);
    if (ok) setProjects(list);
  };

  const openProject = (project) => {
    setActiveProject(project);
    setProjectComments([]);
    lastProjectChatRawRef.current = '';
    setProjectChatMessages([]);
    setProjectDetailTab('comments');
    setEditingProjectDesc(false);
    setView('project-detail');
    loadProjectComments(project.id);
  };

  const loadProjectComments = useCallback(async (projectId) => {
    const raw = await safeGet(PROJECT_COMMENTS_PREFIX + projectId, true);
    setProjectComments(parseList(raw));
  }, []);

  useEffect(() => {
    if (view !== 'project-detail' || !activeProject) return;
    projectCommentsPollRef.current = setInterval(() => loadProjectComments(activeProject.id), 3000);
    return () => clearInterval(projectCommentsPollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, activeProject && activeProject.id]);

  const lastProjectChatRawRef = useRef('');
  const loadProjectChat = useCallback(async (projectId) => {
    const raw = await safeGet(PROJECT_CHAT_PREFIX + projectId, true);
    const rawStr = raw || '';
    if (rawStr !== lastProjectChatRawRef.current) {
      lastProjectChatRawRef.current = rawStr;
      setProjectChatMessages(parseList(raw));
    }
    const traw = await safeGet(TYPING_PREFIX + 'project:' + projectId, true);
    const tlist = parseList(traw);
    const cutoff = Date.now() - TYPING_TTL;
    setProjectChatTypingUsers(tlist.filter((t) => t.lastTyping >= cutoff && t.userId !== userIdRef.current));
  }, []);

  useEffect(() => {
    if (view !== 'project-detail' || !activeProject || projectDetailTab !== 'chat') return;
    loadProjectChat(activeProject.id);
    projectChatPollRef.current = setInterval(() => loadProjectChat(activeProject.id), 2500);
    return () => clearInterval(projectChatPollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, activeProject && activeProject.id, projectDetailTab]);

  useEffect(() => {
    if (autoScrollEnabled) projectChatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [projectChatMessages, autoScrollEnabled]);

  const sendProjectChatMessage = async () => {
    const text = projectChatDraft.trim();
    if (!text || !activeProject || projectChatSending) return;
    setProjectChatSending(true);
    const raw = await safeGet(PROJECT_CHAT_PREFIX + activeProject.id, true);
    let list = parseList(raw);
    list.push({ id: uid(), userId, nickname, text: text.slice(0, COMMENT_MAX_LEN), ts: Date.now() });
    if (list.length > MAX_MESSAGES) list = list.slice(list.length - MAX_MESSAGES);
    const ok = await safeSet(PROJECT_CHAT_PREFIX + activeProject.id, JSON.stringify(list), true);
    if (ok) {
      setProjectChatMessages(list);
      setProjectChatDraft('');
      notifyMentions(text, { projectId: activeProject.id, projectTitle: activeProject.title });
    }
    setProjectChatSending(false);
  };

  const deleteProjectChatMessage = async (msgId) => {
    if (!activeProject) return;
    const raw = await safeGet(PROJECT_CHAT_PREFIX + activeProject.id, true);
    let list = parseList(raw);
    const target = list.find((m) => m.id === msgId);
    if (!target || (target.userId !== userId && !siteAdminUnlocked)) return;
    list = list.map((m) => (m.id === msgId ? { ...m, deleted: true, text: '' } : m));
    const ok = await safeSet(PROJECT_CHAT_PREFIX + activeProject.id, JSON.stringify(list), true);
    if (ok) setProjectChatMessages(list);
  };

  const postProjectComment = async () => {
    const text = projectCommentDraft.trim();
    if (!text || !activeProject || projectCommentSending) return;
    setProjectCommentSending(true);
    const raw = await safeGet(PROJECT_COMMENTS_PREFIX + activeProject.id, true);
    let list = parseList(raw);
    list.push({ id: uid(), userId, nickname, text: text.slice(0, COMMENT_MAX_LEN), ts: Date.now() });
    list = list.slice(-MAX_PROJECT_COMMENTS);
    const ok = await safeSet(PROJECT_COMMENTS_PREFIX + activeProject.id, JSON.stringify(list), true);
    if (ok) {
      setProjectComments(list);
      setProjectCommentDraft('');
      const raw2 = await safeGet(PROJECTS_KEY, true);
      const plist = parseList(raw2).map((p) => (p.id === activeProject.id ? { ...p, commentCount: list.length } : p));
      await safeSet(PROJECTS_KEY, JSON.stringify(plist), true);
      setProjects(plist);
    }
    setProjectCommentSending(false);
  };

  // ---- voice call (WebRTC, storage-signaled, experimental) ----
  // Each signal is now its own row (unique key) instead of being appended into one shared
  // list. Two people can generate several ICE candidates within milliseconds of each other;
  // a shared read-modify-write list loses entries when that happens over the network.
  // Independent inserts never collide - this is what actually fixes "joined but no audio".
  const pushCallSignal = async (roomId, signal) => {
    const key = `${CALL_SIGNAL_PREFIX}${roomId}:${uid()}`;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/kv_store`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({ key, value: JSON.stringify({ ...signal, id: uid(), ts: Date.now() }) }),
      });
    } catch (e) { /* ignore */ }
  };

  const createPeerConnection = useCallback(async (peerId, roomId) => {
    const iceServers = await getIceServers();
    const pc = new RTCPeerConnection({ iceServers });
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) pushCallSignal(roomId, { from: userIdRef.current, to: peerId, kind: 'ice', payload: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      setRemoteStreams((prev) => ({ ...prev, [peerId]: e.streams[0] }));
    };
    pcRefs.current[peerId] = pc;
    return pc;
  }, []);

  const pollCallSignals = useCallback(async (roomId) => {
    let rows = [];
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/kv_store?key=like.${encodeURIComponent(CALL_SIGNAL_PREFIX + roomId + ':')}*&select=key,value`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      if (res.ok) rows = await res.json();
    } catch (e) { return; }

    const cutoff = Date.now() - 30000;
    const doneKeys = [];
    for (const row of rows) {
      let sig;
      try { sig = JSON.parse(row.value); } catch (e) { continue; }
      if (!sig || sig.ts < cutoff) { doneKeys.push(row.key); continue; }
      if (sig.to !== userIdRef.current || processedSignalIdsRef.current.has(sig.id)) continue;
      processedSignalIdsRef.current.add(sig.id);
      doneKeys.push(row.key);
      let pc = pcRefs.current[sig.from];
      try {
        if (sig.kind === 'offer') {
          if (!pc) pc = await createPeerConnection(sig.from, roomId);
          await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await pushCallSignal(roomId, { from: userIdRef.current, to: sig.from, kind: 'answer', payload: answer });
        } else if (sig.kind === 'answer') {
          if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
        } else if (sig.kind === 'ice') {
          if (pc) await pc.addIceCandidate(new RTCIceCandidate(sig.payload));
        }
      } catch (e) { /* ignore malformed / out-of-order signal */ }
    }

    for (const key of doneKeys) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/kv_store?key=eq.${encodeURIComponent(key)}`, {
          method: 'DELETE',
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        });
      } catch (e) { /* ignore */ }
    }
  }, [createPeerConnection]);

  const joinCall = async () => {
    if (!currentRoom) return;
    setCallError('');
    setCallConnecting(true);
    try {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setCallError('マイクにアクセスできませんでした。ブラウザの権限設定をご確認ください。');
      setCallConnecting(false);
      return;
    }
    const roomId = currentRoom.id;
    const state = parseObj(await safeGet(CALL_STATE_PREFIX + roomId, true), { participants: [] });
    const cutoff = Date.now() - CALL_TTL;
    const existingPeers = (state.participants || []).filter((p) => p.lastSeen >= cutoff && p.userId !== userId);
    const participants = [...existingPeers, { userId, nickname, lastSeen: Date.now() }];
    await safeSet(CALL_STATE_PREFIX + roomId, JSON.stringify({ participants }), true);
    setCallParticipants(participants);
    setInCall(true);
    setCallConnecting(false);

    for (const peer of existingPeers) {
      const pc = await createPeerConnection(peer.userId, roomId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await pushCallSignal(roomId, { from: userId, to: peer.userId, kind: 'offer', payload: offer });
    }

    callSignalPollRef.current = setInterval(() => pollCallSignals(roomId), 1500);
    callStatePollRef.current = setInterval(async () => {
      const s = parseObj(await safeGet(CALL_STATE_PREFIX + roomId, true), { participants: [] });
      const cut = Date.now() - CALL_TTL;
      let list = (s.participants || []).filter((p) => p.lastSeen >= cut);
      list = list.map((p) => (p.userId === userIdRef.current ? { ...p, lastSeen: Date.now() } : p));
      if (!list.find((p) => p.userId === userIdRef.current)) list.push({ userId: userIdRef.current, nickname, lastSeen: Date.now() });
      await safeSet(CALL_STATE_PREFIX + roomId, JSON.stringify({ participants: list }), true);
      setCallParticipants(list);
    }, 6000);
  };

  const leaveCall = async () => {
    if (!currentRoom) return;
    const roomId = currentRoom.id;
    Object.values(pcRefs.current).forEach((pc) => { try { pc.close(); } catch (e) { /* ignore */ } });
    pcRefs.current = {};
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setRemoteStreams({});
    clearInterval(callSignalPollRef.current);
    clearInterval(callStatePollRef.current);
    setInCall(false);
    setMuted(false);
    const s = parseObj(await safeGet(CALL_STATE_PREFIX + roomId, true), { participants: [] });
    const list = (s.participants || []).filter((p) => p.userId !== userId);
    await safeSet(CALL_STATE_PREFIX + roomId, JSON.stringify({ participants: list }), true);
    setCallParticipants(list);
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const nextMuted = !muted;
    localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = !nextMuted; });
    setMuted(nextMuted);
  };

  useEffect(() => () => {
    Object.values(pcRefs.current).forEach((pc) => { try { pc.close(); } catch (e) { /* ignore */ } });
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
    clearInterval(callSignalPollRef.current);
    clearInterval(callStatePollRef.current);
  }, []);

  const switchTab = (key) => {
    setError('');
    setView(key);
    if (key === 'dm-list') loadDmThreads();
    if (key === 'moments') {
      loadMoments();
      const now = Date.now();
      setMomentsLastSeen(now);
      try { window.localStorage.setItem('studio:lastseen:moments', String(now)); } catch (e) {}
    }
    if (key === 'projects') {
      loadProjects();
      const now = Date.now();
      setProjectsLastSeen(now);
      try { window.localStorage.setItem('studio:lastseen:projects', String(now)); } catch (e) {}
    }
  };

  const hasNewMoments = moments.some((m) => m.userId !== userId && m.ts > momentsLastSeen);
  const hasNewProjects = projects.some((p) => p.authorId !== userId && p.ts > projectsLastSeen);

  const vars = {
    '--bg': '#E5E7DE',
    '--panel': '#FFFFFF',
    '--panel-alt': '#F4F4F1',
    '--line': '#DDDED4',
    '--ink': '#575757',
    '--ink-strong': '#3B3B3B',
    '--ink-soft': '#8D8D84',
    '--link': '#0E90D4',
    '--accent': '#FF8C1A',
    '--accent-deep': '#E56F00',
    '--owner': '#4C97FF',
    '--owner-deep': '#3373D9',
    '--danger': '#D6393A',
    '--danger-deep': '#B72E2E',
  };

  const shellStyle = {
    ...vars,
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    background: 'var(--bg)',
    color: 'var(--ink)',
    height: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    border: 'none',
    borderRadius: 0,
    boxShadow: 'none',
    position: 'relative',
  };

  const customCss = `
    ${FONT_IMPORT}
    html, body, #root { height: 100%; margin: 0; padding: 0; }
    .sc-scope * { box-sizing: border-box; }
    .sc-btn-primary {
      background: var(--accent); color: #fff; border: none;
      transition: background 0.15s ease, transform 0.08s ease;
    }
    .sc-btn-primary:hover:not(:disabled) { background: var(--accent-deep); }
    .sc-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
    .sc-btn-primary:active:not(:disabled) { transform: scale(0.97); }
    .sc-btn-owner { background: var(--owner); color: #fff; border: none; transition: background 0.15s ease; }
    .sc-btn-owner:hover { background: var(--owner-deep); }
    .sc-btn-danger {
      background: #fff; color: var(--danger); border: 1px solid var(--danger);
      transition: background 0.15s ease, color 0.15s ease;
    }
    .sc-btn-danger:hover { background: var(--danger); color: #fff; }
    .sc-input { background: #fff; border: 1px solid var(--line); color: var(--ink-strong); }
    .sc-input:focus { outline: none; border-color: var(--owner); box-shadow: 0 0 0 3px rgba(76,151,255,0.18); }
    .sc-scroll::-webkit-scrollbar { width: 9px; }
    .sc-scroll::-webkit-scrollbar-thumb { background: #CBCDC1; border-radius: 8px; }
    .sc-room-card {
      background: var(--panel); border: 1px solid var(--line); border-radius: 8px;
      transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
      cursor: pointer; text-align: left; overflow: hidden; position: relative;
    }
    .sc-room-card:hover { border-color: var(--owner); box-shadow: 0 2px 8px rgba(76,151,255,0.18); transform: translateY(-1px); }
    .sc-comment-row { animation: scRowIn 0.3s ease; }
    @keyframes scRowIn { 0% { opacity: 0; transform: translateY(4px); } 100% { opacity: 1; transform: translateY(0); } }
    .sc-action-link {
      background: none; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;
      color: var(--ink-soft); font-size: 11px; font-weight: 600; padding: 2px 4px; border-radius: 4px;
    }
    .sc-action-link:hover { background: var(--panel-alt); color: var(--ink-strong); }
    .sc-action-link.danger:hover { background: #FBEAEA; color: var(--danger); }
    .sc-post-btn { border-radius: 20px; padding: 0 18px; height: 34px; font-weight: 700; font-size: 13px; }
    .sc-icon-btn {
      background: rgba(255,255,255,0.14); border: none; border-radius: 6px; width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center; cursor: pointer; color: #fff; flex-shrink: 0;
      transition: background 0.15s ease;
    }
    .sc-icon-btn:hover { background: rgba(255,255,255,0.28); }
    .sc-icon-btn.active { background: rgba(255,255,255,0.28); }
    .sc-swatch { width: 26px; height: 26px; border-radius: 6px; cursor: pointer; border: 2px solid transparent; flex-shrink: 0; }
    .sc-swatch.selected { border-color: var(--ink-strong); }
    .sc-emoji-btn {
      width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--line); background: #fff;
      cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center;
    }
    .sc-emoji-btn.selected { border-color: var(--owner); box-shadow: 0 0 0 2px rgba(76,151,255,0.25); }
    .sc-modal-overlay {
      position: absolute; inset: 0; background: rgba(20,18,15,0.5); z-index: 50;
      display: flex; align-items: center; justify-content: center; padding: 16px;
    }
    .sc-modal {
      background: var(--panel); border-radius: 10px; width: 100%; max-width: 340px; max-height: 90%;
      overflow-y: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.25); padding: 16px;
    }
    .sc-tab-btn {
      flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 0;
      background: none; border: none; cursor: pointer; color: var(--ink-soft);
    }
    .sc-tab-btn.active { color: var(--owner); }
    .sc-card {
      background: var(--panel); border: 1px solid var(--line); border-radius: 10px; overflow: hidden;
    }
    .sc-feed-btn {
      background: var(--panel); border: 1px solid var(--line); border-radius: 8px; cursor: pointer;
      text-align: left; overflow: hidden; transition: box-shadow 0.15s ease, transform 0.1s ease;
    }
    .sc-feed-btn:hover { box-shadow: 0 2px 8px rgba(76,151,255,0.16); transform: translateY(-1px); }
  `;

  const visibleRooms = rooms.filter((r) => canView(r, userId));
  const roomsUnreadCount = visibleRooms.filter((r) => r.lastSenderId && r.lastSenderId !== userId && r.lastActivity > (roomLastSeenMap[r.id] || 0)).length;

  useEffect(() => {
    visibleRooms.forEach((r) => {
      [r.thumbFileId, r.bgFileId, r.bgmFileId].forEach((fid) => {
        if (!fid || roomThumbCache[fid]) return;
        (async () => {
          const fraw = await safeGet(FILE_PREFIX + fid, true);
          if (!fraw) return;
          try {
            const fp = JSON.parse(fraw);
            setRoomThumbCache((prev) => ({ ...prev, [fid]: fp.dataUrl }));
          } catch (e) { /* ignore */ }
        })();
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms]);

  useEffect(() => {
    if (!currentRoom || !currentRoom.bgFileId || roomThumbCache[currentRoom.bgFileId]) return;
    (async () => {
      const fraw = await safeGet(FILE_PREFIX + currentRoom.bgFileId, true);
      if (!fraw) return;
      try {
        const fp = JSON.parse(fraw);
        setRoomThumbCache((prev) => ({ ...prev, [currentRoom.bgFileId]: fp.dataUrl }));
      } catch (e) { /* ignore */ }
    })();
  }, [currentRoom, roomThumbCache]);

  useEffect(() => {
    if (!currentRoom || !currentRoom.bgmFileId || roomThumbCache[currentRoom.bgmFileId]) return;
    (async () => {
      const fraw = await safeGet(FILE_PREFIX + currentRoom.bgmFileId, true);
      if (!fraw) return;
      try {
        const fp = JSON.parse(fraw);
        setRoomThumbCache((prev) => ({ ...prev, [currentRoom.bgmFileId]: fp.dataUrl }));
      } catch (e) { /* ignore */ }
    })();
  }, [currentRoom, roomThumbCache]);

  const roomBgFileInputRef = useRef(null);
  const [roomBgUploading, setRoomBgUploading] = useState(false);
  const roomBgmFileInputRef = useRef(null);
  const [roomBgmUploading, setRoomBgmUploading] = useState(false);
  const [bgmEnabled, setBgmEnabled] = useState(false);
  const bgmAudioRef = useRef(null);

  useEffect(() => {
    setBgmEnabled(false);
  }, [currentRoom && currentRoom.id]);

  useEffect(() => {
    const el = bgmAudioRef.current;
    if (!el) return;
    if (bgmEnabled) {
      el.play().catch(() => setBgmEnabled(false));
    } else {
      el.pause();
    }
  }, [bgmEnabled, currentRoom && currentRoom.bgmFileId]);

  useEffect(() => {
    if (view !== 'lobby' || visibleRooms.length === 0) return;
    let cancelled = false;
    const cutoff = () => Date.now() - PRESENCE_TTL;
    const poll = async () => {
      const entries = await Promise.all(visibleRooms.slice(0, 30).map(async (r) => {
        const raw = await safeGet(PRESENCE_PREFIX + r.id, true);
        const list = parseList(raw).filter((p) => p.lastSeen >= cutoff());
        return [r.id, list];
      }));
      if (cancelled) return;
      setLobbyPresenceMap(Object.fromEntries(entries));
    };
    poll();
    const t = setInterval(poll, 10000);
    return () => { cancelled = true; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, rooms.length]);

  if (!nickReady) {
    return (
      <div className="sc-scope w-full flex items-center justify-center" style={{ ...shellStyle, alignItems: 'center', justifyContent: 'center' }}>
        <style>{customCss}</style>
        <Loader2 className="animate-spin" style={{ color: 'var(--owner)' }} size={28} />
      </div>
    );
  }

  if (!nicknameSet) {
    return (
      <div className="sc-scope w-full overflow-hidden" style={shellStyle}>
        <style>{customCss}</style>
        <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--owner)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Folder size={24} strokeWidth={2.2} />
            </div>
            <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 24, margin: 0, color: 'var(--ink-strong)' }}>
              スタジオコメント
            </h1>
          </div>
          <p style={{ color: 'var(--ink-soft)', fontSize: 13.5, textAlign: 'center', margin: 0, maxWidth: 320, lineHeight: 1.7 }}>
            アカウント登録は不要です。ニックネームを決めればすぐにコメントできます。
          </p>
          <div className="w-full" style={{ maxWidth: 320 }}>
            <label style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600 }}>ニックネーム</label>
            <input
              className="sc-input w-full rounded-lg mt-1 px-3 py-2 text-sm"
              placeholder="名無しさん"
              maxLength={16}
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmNickname(); }}
            />
          </div>
          <button
            className="sc-btn-primary w-full rounded-full py-2.5 text-sm"
            style={{ maxWidth: 320, fontWeight: 700 }}
            disabled={!nicknameInput.trim()}
            onClick={confirmNickname}
          >
            はじめる
          </button>
          <div style={{ background: 'var(--panel-alt)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', maxWidth: 320, width: '100%' }}>
            <div style={{ fontSize: 10.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
              あなたには偽ユーザー防止用の固定個人IDが自動で割り当てられます。ニックネームは他の人と重複することがありますが、個人IDは変わりません。
            </div>
          </div>
        </div>
      </div>
    );
  }

  const onPickRoomBg = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || !currentRoom || !isAdmin) return;
    setRoomBgUploading(true);
    try {
      const { dataUrl } = await compressImage(file, 900, 0.78);
      const fileId = uid();
      await safeSet(FILE_PREFIX + fileId, JSON.stringify({ name: 'bg', mimeType: 'image/jpeg', dataUrl }), true);
      await updateRoomField((r) => ({ ...r, bgFileId: fileId }));
      setRoomThumbCache((prev) => ({ ...prev, [fileId]: dataUrl }));
    } catch (err) {
      setError('背景画像を読み込めませんでした。');
    }
    setRoomBgUploading(false);
  };
  const clearRoomBg = async () => {
    if (!currentRoom || !isAdmin) return;
    await updateRoomField((r) => ({ ...r, bgFileId: null }));
  };

  const onPickRoomBgm = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || !currentRoom || !isAdmin) return;
    if (!file.type.startsWith('audio/')) {
      setError('音声ファイルを選んでください。');
      return;
    }
    if (file.size > MAX_BGM_BYTES) {
      setError('BGMファイルが大きすぎます（5MB以下にしてください）');
      return;
    }
    setRoomBgmUploading(true);
    try {
      const dataUrl = await readAsDataURL(file);
      const fileId = uid();
      const ok = await safeSet(FILE_PREFIX + fileId, JSON.stringify({ name: file.name, mimeType: file.type, dataUrl }), true);
      if (ok) {
        await updateRoomField((r) => ({ ...r, bgmFileId: fileId, bgmName: file.name }));
        setRoomThumbCache((prev) => ({ ...prev, [fileId]: dataUrl }));
      } else {
        setError('BGMのアップロードに失敗しました。');
      }
    } catch (err) {
      setError('BGMファイルを読み込めませんでした。');
    }
    setRoomBgmUploading(false);
  };

  const clearRoomBgm = async () => {
    if (!currentRoom || !isAdmin) return;
    setBgmEnabled(false);
    await updateRoomField((r) => ({ ...r, bgmFileId: null, bgmName: null }));
  };

  const onPickRoomThumb = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || !currentRoom || !isAdmin) return;
    setRoomThumbUploading(true);
    try {
      const { dataUrl } = await compressImage(file, 400, 0.8);
      const fileId = uid();
      await safeSet(FILE_PREFIX + fileId, JSON.stringify({ name: 'thumb', mimeType: 'image/jpeg', dataUrl }), true);
      await updateRoomField((r) => ({ ...r, thumbFileId: fileId }));
      setRoomThumbCache((prev) => ({ ...prev, [fileId]: dataUrl }));
      setRooms((prev) => prev.map((r) => (r.id === currentRoom.id ? { ...r, thumbFileId: fileId } : r)));
    } catch (err) {
      setError('サムネ画像を読み込めませんでした。');
    }
    setRoomThumbUploading(false);
  };
  const onlineNonOwner = presence.filter((p) => p.userId !== userId && (!currentRoom || p.userId !== currentRoom.ownerId));
  const filteredLogs = messages.filter((m) => {
    if (!logQuery.trim()) return true;
    const q = logQuery.trim().toLowerCase();
    return (m.nickname || '').toLowerCase().includes(q) || (!m.deleted && (m.text || '').toLowerCase().includes(q));
  });
  const analytics = currentRoom ? computeAnalytics(messages) : null;
  const showTabBar = ['lobby', 'dm-list', 'moments', 'projects'].includes(view);

  const openViewProfile = (uidTarget, nick) => setViewProfileTarget({ userId: uidTarget, nickname: nick });

  const renderAttachment = (m) => {
    if (!m.attachment) return null;
    if (m.attachment.kind === 'image' || m.attachment.kind === 'stamp') {
      const isStamp = m.attachment.kind === 'stamp';
      return (
        <div style={{ marginTop: 6 }}>
          {fileCache[m.attachment.fileId] ? (
            <img
              src={fileCache[m.attachment.fileId]}
              alt={m.attachment.name}
              onClick={() => !isStamp && setLightbox(fileCache[m.attachment.fileId])}
              style={{
                maxWidth: isStamp ? 100 : 220, maxHeight: isStamp ? 100 : 220, borderRadius: isStamp ? 0 : 6,
                border: isStamp ? 'none' : '1px solid var(--line)', cursor: isStamp ? 'default' : 'zoom-in', display: 'block',
              }}
            />
          ) : (
            <div style={{ width: 120, height: 80, background: 'var(--panel-alt)', border: '1px solid var(--line)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Loader2 className="animate-spin" size={16} style={{ color: 'var(--ink-soft)' }} />
            </div>
          )}
        </div>
      );
    }
    return (
      <a
        href={fileCache[m.attachment.fileId] || undefined}
        download={m.attachment.name}
        style={{
          marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px',
          background: 'var(--panel-alt)', border: '1px solid var(--line)', borderRadius: 6,
          fontSize: 12, color: 'var(--ink)', textDecoration: 'none',
        }}
      >
        <Paperclip size={13} />
        {m.attachment.name}
        <span style={{ color: 'var(--ink-soft)', fontFamily: "'JetBrains Mono', monospace" }}>{formatSize(m.attachment.size)}</span>
      </a>
    );
  };

  return (
    <div className="sc-scope w-full overflow-hidden" style={shellStyle}>
      <style>{customCss}</style>

      {announcement && announcementDismissed !== announcement.id && (
        <div style={{ background: '#FFF4D6', borderBottom: '1px solid #E8D9A6', padding: '8px 14px', display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0 }}>
          <Info size={13} style={{ marginTop: 1, flexShrink: 0, color: '#8A6D00' }} />
          <div style={{ flex: 1, fontSize: 11.5, color: '#5C4A00', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {announcement.text}
          </div>
          <button onClick={dismissAnnouncement} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A6D00', flexShrink: 0 }}>
            <X size={13} />
          </button>
        </div>
      )}

      {view === 'lobby' && (
        <>
          <div style={{ background: 'var(--owner)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 6, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Folder size={16} color="#fff" />
              </div>
              <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 17, margin: 0, color: '#fff' }}>
                マイスタジオ
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={openNotifications} style={{ position: 'relative', background: 'rgba(255,255,255,0.14)', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Bell size={15} color="#EAF2FF" />
                {notifUnreadCount > 0 && (
                  <span style={{ position: 'absolute', top: -2, right: -2, minWidth: 14, height: 14, padding: '0 3px', borderRadius: 7, background: 'var(--danger)', color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {notifUnreadCount > 9 ? '9+' : notifUnreadCount}
                  </span>
                )}
              </button>
              <button onClick={openProfileModal} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.14)', border: 'none', borderRadius: 20, padding: '3px 10px 3px 3px', cursor: 'pointer' }}>
                <Avatar userId={userId} nickname={nickname} profiles={profiles} avatarCache={avatarCache} size={24} />
                <span style={{ fontSize: 12.5, color: '#EAF2FF', fontWeight: 600 }}>{nickname}</span>
                <Settings size={13} color="#EAF2FF" />
              </button>
            </div>
          </div>

          <div className="sc-scroll" style={{ flex: 1, overflowY: 'auto', padding: '18px' }}>
            <h2 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 13, margin: '0 0 12px', color: 'var(--ink-strong)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              スタジオを選ぶ
            </h2>

            {error && (
              <div style={{ background: '#FBEAEA', border: '1px solid var(--danger)', color: 'var(--danger-deep)', borderRadius: 6, padding: '8px 10px', fontSize: 12.5, marginBottom: 12 }}>
                {error}
              </div>
            )}

            {roomsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-soft)', fontSize: 13 }}>
                <Loader2 className="animate-spin" size={16} /> スタジオを確認しています…
              </div>
            ) : visibleRooms.length === 0 ? (
              <p style={{ color: 'var(--ink-soft)', fontSize: 13, lineHeight: 1.7 }}>
                まだスタジオがありません。下から最初のスタジオを作ってみましょう。
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
                {visibleRooms.map((r) => {
                  const roomOnline = (lobbyPresenceMap[r.id] || []).filter((p) => p.userId !== userId);
                  const thumbUrl = r.thumbFileId ? roomThumbCache[r.thumbFileId] : null;
                  const roomUnread = !!(r.lastSenderId && r.lastSenderId !== userId && r.lastActivity > (roomLastSeenMap[r.id] || 0));
                  return (
                  <button key={r.id} className="sc-room-card" onClick={() => enterRoom(r)}>
                    <div style={{ position: 'relative', height: 64, background: 'var(--panel-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--line)', overflow: 'hidden' }}>
                      {thumbUrl ? (
                        <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Folder size={22} color="var(--ink-soft)" />
                      )}
                      {roomUnread && (
                        <div style={{ position: 'absolute', top: 6, left: 6, width: 9, height: 9, borderRadius: '50%', background: 'var(--danger)', border: '2px solid #fff' }} />
                      )}
                      {r.private && (
                        <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(59,58,56,0.8)', borderRadius: 5, padding: '2px 5px', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Lock size={10} color="#fff" />
                          <span style={{ fontSize: 9, color: '#fff', fontWeight: 700 }}>非公開</span>
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '9px 11px 11px' }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink-strong)', marginBottom: 4, wordBreak: 'break-word' }}>
                        {r.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--ink-soft)', fontFamily: "'JetBrains Mono', monospace", flexWrap: 'wrap' }}>
                        {r.ownerId === userId && (
                          <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 3, padding: '1px 4px', fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>管理者</span>
                        )}
                        {r.messageCount ? `コメント${r.messageCount}件・${fmtRelative(r.lastActivity)}` : 'まだ書き込みなし'}
                      </div>
                      {roomOnline.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: -4, marginTop: 6 }}>
                          {roomOnline.slice(0, 5).map((p) => (
                            <div key={p.userId} style={{ marginRight: -6 }}>
                              <Avatar userId={p.userId} nickname={p.nickname} profiles={profiles} avatarCache={avatarCache} size={18} isOnline />
                            </div>
                          ))}
                          {roomOnline.length > 5 && (
                            <span style={{ fontSize: 9.5, color: 'var(--ink-soft)', marginLeft: 6 }}>+{roomOnline.length - 5}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--line)', padding: '14px 18px', flexShrink: 0, background: 'var(--panel-alt)' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600, marginBottom: 6 }}>
              新しいスタジオを作る
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                className="sc-input flex-1 rounded-lg px-3 py-2 text-sm"
                placeholder="スタジオ名（例: 作品発表スタジオ）"
                maxLength={24}
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createRoom(); }}
              />
              <button
                className="sc-btn-primary rounded-lg px-4 text-sm flex items-center gap-1"
                style={{ fontWeight: 700 }}
                disabled={!newRoomName.trim() || creatingRoom}
                onClick={createRoom}
              >
                {creatingRoom ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                作る
              </button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink)', cursor: 'pointer' }}>
              <input type="checkbox" checked={newRoomPrivate} onChange={(e) => setNewRoomPrivate(e.target.checked)} />
              <Lock size={12} color="var(--ink-soft)" />
              プライベートスタジオにする（自分が招待した人だけ入室できます）
            </label>
          </div>
        </>
      )}

      {view === 'room' && currentRoom && (
        <>
          {Object.entries(remoteStreams).map(([peerId, stream]) => (
            <audio key={peerId} autoPlay ref={(el) => { if (el) el.srcObject = stream; }} style={{ display: 'none' }} />
          ))}

          <div style={{ background: 'var(--owner)', padding: '12px 16px', flexShrink: 0, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={leaveRoom} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}>
                <ArrowLeft size={20} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15.5, color: '#fff', wordBreak: 'break-word', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {currentRoom.private && <Lock size={13} />}
                  {currentRoom.name}
                </div>
                <div style={{ fontSize: 10.5, color: '#DCEBFF', fontFamily: "'JetBrains Mono', monospace", marginTop: 1 }}>
                  管理者: {currentRoom.ownerNickname}
                </div>
              </div>
              <button className={`sc-icon-btn ${autoScrollEnabled ? 'active' : ''}`} title={autoScrollEnabled ? '自動スクロール: ON' : '自動スクロール: OFF'} onClick={() => setAutoScrollEnabled((v) => !v)}>
                <ArrowDownCircle size={16} />
              </button>
              {currentRoom.bgmFileId && (
                <button className={`sc-icon-btn ${bgmEnabled ? 'active' : ''}`} title={bgmEnabled ? 'BGMを止める' : 'BGMを再生'} onClick={() => setBgmEnabled((v) => !v)}>
                  {bgmEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
              )}
              <button className={`sc-icon-btn ${analyticsOpen ? 'active' : ''}`} title="会話の分析" onClick={() => { setAnalyticsOpen((v) => !v); setAdminPanelOpen(false); setLogsOpen(false); }}>
                <BarChart3 size={16} />
              </button>
              <button className="sc-icon-btn" title="ログを検索" onClick={() => { setLogsOpen((v) => !v); setAnalyticsOpen(false); }}>
                <History size={16} />
              </button>
              {isAdmin && (
                <button className={`sc-icon-btn ${adminPanelOpen ? 'active' : ''}`} title="管理パネル" onClick={() => { setAdminPanelOpen((v) => !v); setAnalyticsOpen(false); setLogsOpen(false); }}>
                  <ShieldCheck size={16} />
                </button>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <Users size={13} color="#DCEBFF" />
              {presence.length === 0 ? (
                <span style={{ fontSize: 11, color: '#DCEBFF', fontFamily: "'JetBrains Mono', monospace" }}>確認中…</span>
              ) : (
                presence.slice(0, 8).map((p) => (
                  <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }} onClick={() => openViewProfile(p.userId, p.nickname)}>
                    <Avatar userId={p.userId} nickname={p.nickname} profiles={profiles} avatarCache={avatarCache} size={16} isOwner={p.userId === currentRoom.ownerId} isOnline={isUserOnline(p.userId)} />
                    <span style={{ fontSize: 11, color: '#DCEBFF' }}>{p.nickname}</span>
                  </div>
                ))
              )}
              {presence.length > 8 && (
                <span style={{ fontSize: 11, color: '#DCEBFF' }}>ほか{presence.length - 8}名</span>
              )}
            </div>

            {analyticsOpen && analytics && (
              <div style={{
                position: 'absolute', top: '100%', left: 12, right: 12, marginTop: 6, maxHeight: 380, overflowY: 'auto',
                background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
                zIndex: 30, padding: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontWeight: 800, fontSize: 12.5, color: 'var(--ink-strong)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <BarChart3 size={14} color="var(--owner)" /> 会話の分析（読み込み済みログ内）
                  </div>
                  <button onClick={() => setAnalyticsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', display: 'flex' }}>
                    <X size={14} />
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 8 }}>
                  合計{analytics.total}件・画像{analytics.images}件・スタンプ{analytics.stamps}件・ファイル{analytics.files}件
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', marginBottom: 6 }}>投稿数ランキング</div>
                {analytics.topUsers.length === 0 ? (
                  <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginBottom: 10 }}>データがありません。</div>
                ) : (
                  <div style={{ marginBottom: 12 }}>
                    {analytics.topUsers.map(([name, count]) => (
                      <BarRow key={name} label={name} count={count} max={analytics.maxUser} color="var(--owner)" />
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', marginBottom: 6, borderTop: '1px solid var(--line)', paddingTop: 8 }}>日別の投稿数</div>
                {analytics.dayEntries.length === 0 ? (
                  <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>データがありません。</div>
                ) : (
                  analytics.dayEntries.map(([day, count]) => (
                    <BarRow key={day} label={day} count={count} max={analytics.maxDay} color="var(--accent)" />
                  ))
                )}
              </div>
            )}

            {adminPanelOpen && isAdmin && (
              <div style={{
                position: 'absolute', top: '100%', right: 12, marginTop: 6, width: 264, maxHeight: 360, overflowY: 'auto',
                background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
                zIndex: 30, padding: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 12.5, color: 'var(--ink-strong)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <ShieldCheck size={14} color="var(--owner)" /> 管理パネル
                  </div>
                  <button onClick={() => setAdminPanelOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', display: 'flex' }}>
                    <X size={14} />
                  </button>
                </div>

                {siteAdminUnlocked && (
                  <button className="sc-action-link" style={{ border: '1px solid var(--owner)', color: 'var(--owner)', borderRadius: 5, marginBottom: 10, width: '100%', justifyContent: 'center', padding: '5px 0' }} onClick={openDmMonitor}>
                    <MessageCircle size={12} /> DM監視（チャット管理者専用）
                  </button>
                )}

                <input type="file" ref={roomThumbFileInputRef} style={{ display: 'none' }} onChange={onPickRoomThumb} accept="image/*" />
                <button className="sc-action-link" style={{ border: '1px solid var(--line)', borderRadius: 5, marginBottom: 10, width: '100%', justifyContent: 'center', padding: '5px 0' }} onClick={() => roomThumbFileInputRef.current?.click()} disabled={roomThumbUploading}>
                  {roomThumbUploading ? <Loader2 className="animate-spin" size={12} /> : <Camera size={12} />} スタジオのサムネを設定
                </button>

                <input type="file" ref={roomBgFileInputRef} style={{ display: 'none' }} onChange={onPickRoomBg} accept="image/*" />
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  <button className="sc-action-link" style={{ border: '1px solid var(--line)', borderRadius: 5, flex: 1, justifyContent: 'center', padding: '5px 0' }} onClick={() => roomBgFileInputRef.current?.click()} disabled={roomBgUploading}>
                    {roomBgUploading ? <Loader2 className="animate-spin" size={12} /> : <ImageIcon size={12} />} チャット背景を設定
                  </button>
                  {currentRoom.bgFileId && (
                    <button className="sc-action-link" style={{ border: '1px solid var(--line)', borderRadius: 5, flexShrink: 0, padding: '5px 8px' }} onClick={clearRoomBg} title="背景を元に戻す">
                      <X size={12} />
                    </button>
                  )}
                </div>

                <input type="file" ref={roomBgmFileInputRef} style={{ display: 'none' }} onChange={onPickRoomBgm} accept="audio/*" />
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  <button className="sc-action-link" style={{ border: '1px solid var(--line)', borderRadius: 5, flex: 1, justifyContent: 'center', padding: '5px 0' }} onClick={() => roomBgmFileInputRef.current?.click()} disabled={roomBgmUploading}>
                    {roomBgmUploading ? <Loader2 className="animate-spin" size={12} /> : <Music size={12} />} BGMを設定{currentRoom.bgmName ? `（${currentRoom.bgmName}）` : ''}
                  </button>
                  {currentRoom.bgmFileId && (
                    <button className="sc-action-link" style={{ border: '1px solid var(--line)', borderRadius: 5, flexShrink: 0, padding: '5px 8px' }} onClick={clearRoomBgm} title="BGMを削除">
                      <X size={12} />
                    </button>
                  )}
                </div>

                <button className="sc-action-link danger" style={{ border: '1px solid var(--danger)', borderRadius: 5, marginBottom: 10, width: '100%', justifyContent: 'center', padding: '5px 0' }} onClick={deleteRoom}>
                  <Trash2 size={12} /> このスタジオを削除する
                </button>

                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 }}>
                  オンラインメンバー
                </div>
                {onlineNonOwner.length === 0 ? (
                  <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginBottom: 10 }}>他のメンバーはいません。</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    {onlineNonOwner.map((p) => (
                      <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Avatar userId={p.userId} nickname={p.nickname} profiles={profiles} avatarCache={avatarCache} size={20} isOnline={isUserOnline(p.userId)} onClick={() => openViewProfile(p.userId, p.nickname)} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: 'var(--ink-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nickname}</div>
                          <IdTag userId={p.userId} />
                        </div>
                        {currentRoom.private && !(currentRoom.allowedUserIds || []).includes(p.userId) && (
                          <button className="sc-action-link" style={{ border: '1px solid var(--owner)', borderRadius: 5, color: 'var(--owner)' }} onClick={() => addAllowedMember(p.userId)}>
                            <UserPlus size={11} /> 招待
                          </button>
                        )}
                        <button className="sc-action-link danger" style={{ border: '1px solid var(--danger)', borderRadius: 5 }} onClick={() => banUser(p.userId)}>
                          <Ban size={11} /> BAN
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {currentRoom.private && (
                  <>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                      招待済みメンバー
                    </div>
                    {(!currentRoom.allowedUserIds || currentRoom.allowedUserIds.length === 0) ? (
                      <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginBottom: 10 }}>まだ誰も招待していません。</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                        {currentRoom.allowedUserIds.map((id) => (
                          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <IdTag userId={id} />
                            <button className="sc-action-link" style={{ border: '1px solid var(--line)', borderRadius: 5, marginLeft: 'auto' }} onClick={() => removeAllowedMember(id)}>
                              削除
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 }}>
                      個人IDで招待
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      <input
                        className="sc-input rounded px-2 py-1 text-xs flex-1"
                        placeholder="相手の個人ID"
                        value={inviteIdDraft}
                        onChange={(e) => setInviteIdDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') addAllowedMember(inviteIdDraft); }}
                      />
                      <button className="sc-action-link" style={{ border: '1px solid var(--owner)', borderRadius: 5, color: 'var(--owner)' }} onClick={() => addAllowedMember(inviteIdDraft)}>
                        招待
                      </button>
                    </div>
                  </>
                )}

                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                  BAN中のユーザー
                </div>
                {(!currentRoom.bannedUserIds || currentRoom.bannedUserIds.length === 0) ? (
                  <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>BAN中のユーザーはいません。</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {currentRoom.bannedUserIds.map((id) => (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <IdTag userId={id} />
                        <button className="sc-action-link" style={{ border: '1px solid var(--line)', borderRadius: 5, marginLeft: 'auto' }} onClick={() => unbanUser(id)}>
                          解除する
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {logsOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 12, right: 12, marginTop: 6, maxHeight: 380,
                background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
                zIndex: 30, display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ padding: 10, borderBottom: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 12.5, color: 'var(--ink-strong)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <History size={14} color="var(--owner)" /> ログを検索
                    </div>
                    <button onClick={() => setLogsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', display: 'flex' }}>
                      <X size={14} />
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-soft)' }} />
                    <input
                      className="sc-input w-full rounded px-2 py-1.5 text-xs"
                      style={{ paddingLeft: 26 }}
                      placeholder="ニックネームや本文で検索"
                      value={logQuery}
                      onChange={(e) => setLogQuery(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div style={{ fontSize: 9.5, color: 'var(--ink-soft)', marginTop: 5 }}>最新200件までを保存しています（{filteredLogs.length}件表示中）</div>
                </div>
                <div className="sc-scroll" style={{ overflowY: 'auto', padding: '6px 10px' }}>
                  {filteredLogs.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', padding: '10px 2px' }}>一致するログがありません。</div>
                  ) : (
                    filteredLogs.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => { setLogsOpen(false); scrollToMessage(m.id); }}
                        style={{ display: 'flex', gap: 8, padding: '6px 2px', borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
                      >
                        <Avatar userId={m.userId} nickname={m.nickname} profiles={profiles} avatarCache={avatarCache} size={20} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                            <span style={{ color: 'var(--link)', fontWeight: 700, fontSize: 11.5 }}>{m.nickname}</span>
                            <span style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{fmtRelative(m.ts)}</span>
                          </div>
                          <div style={{ fontSize: 12, color: m.deleted ? 'var(--ink-soft)' : 'var(--ink)', fontStyle: m.deleted ? 'italic' : 'normal', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {m.deleted ? '（削除済み）' : (m.text || (m.attachment ? `［${m.attachment.kind === 'image' ? '画像' : m.attachment.kind === 'stamp' ? 'スタンプ' : m.attachment.name}］` : ''))}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: '10px 14px 0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PhoneCall size={14} color={inCall ? 'var(--owner)' : 'var(--ink-soft)'} />
              <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                {callParticipants.length > 0 ? `通話中: ${callParticipants.length}人` : '通話はまだ開始されていません'}
              </span>
              {callParticipants.slice(0, 5).map((p) => (
                <Avatar key={p.userId} userId={p.userId} nickname={p.nickname} profiles={profiles} avatarCache={avatarCache} size={16} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {!inCall ? (
                <button className="sc-action-link" style={{ border: '1px solid var(--owner)', color: 'var(--owner)', borderRadius: 5 }} onClick={joinCall} disabled={callConnecting}>
                  {callConnecting ? <Loader2 className="animate-spin" size={11} /> : <PhoneCall size={11} />} 参加する
                </button>
              ) : (
                <>
                  <button className="sc-action-link" style={{ border: '1px solid var(--line)', borderRadius: 5 }} onClick={toggleMute}>
                    {muted ? <MicOff size={11} /> : <Mic size={11} />} {muted ? 'ミュート中' : 'ミュート'}
                  </button>
                  <button className="sc-action-link danger" style={{ border: '1px solid var(--danger)', borderRadius: 5 }} onClick={leaveCall}>
                    <PhoneOff size={11} /> 退出
                  </button>
                </>
              )}
            </div>
          </div>
          {callError && <div style={{ padding: '0 14px', fontSize: 10.5, color: 'var(--danger)' }}>{callError}</div>}

          <div style={{ padding: '8px 14px 0', flexShrink: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-strong)' }}>
              コメント（{messages.filter((m) => !m.deleted).length}）
            </div>
          </div>

          {currentRoom.bgmFileId && roomThumbCache[currentRoom.bgmFileId] && (
            <audio ref={bgmAudioRef} src={roomThumbCache[currentRoom.bgmFileId]} loop style={{ display: 'none' }} />
          )}

          <div
            ref={messagesScrollRef}
            className="sc-scroll"
            style={{
              flex: 1, overflowY: 'auto', padding: '10px 14px 14px',
              backgroundImage: currentRoom.bgFileId && roomThumbCache[currentRoom.bgFileId] ? `url(${roomThumbCache[currentRoom.bgFileId]})` : undefined,
              backgroundSize: 'cover', backgroundPosition: 'center',
            }}
            onScroll={handleMessagesScroll}
            onClick={() => { setAdminPanelOpen(false); setLogsOpen(false); setAnalyticsOpen(false); }}
          >
            {messagesLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-soft)', fontSize: 13, marginTop: 10 }}>
                <Loader2 className="animate-spin" size={16} /> 読み込み中…
              </div>
            ) : messages.length === 0 ? (
              <div style={{ color: 'var(--ink-soft)', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
                まだコメントがありません。最初の一言をどうぞ。
              </div>
            ) : (
              messages.map((m) => {
                const mine = m.userId === userId;
                const ownerMsg = currentRoom && m.userId === currentRoom.ownerId;
                const canDelete = !m.deleted && (isAdmin || mine);
                const messageReaders = reads.filter((r) => r.userId !== m.userId && r.lastReadTs >= m.ts);
                return (
                  <div
                    key={m.id}
                    id={`sc-msg-${m.id}`}
                    className="sc-comment-row"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: 'flex', gap: 10, padding: '10px 4px',
                      borderBottom: '1px solid var(--line)',
                      background: highlightId === m.id ? 'rgba(76,151,255,0.10)' : 'transparent',
                      transition: 'background 0.6s ease',
                    }}
                  >
                    <Avatar userId={m.userId} nickname={m.nickname} profiles={profiles} avatarCache={avatarCache} size={30} isOwner={ownerMsg} isOnline={isUserOnline(m.userId)} onClick={() => openViewProfile(m.userId, m.nickname)} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--link)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }} onClick={() => openViewProfile(m.userId, m.nickname)}>{m.nickname}</span>
                        <IdTag userId={m.userId} />
                        {ownerMsg && (
                          <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 3, padding: '1px 5px', fontSize: 9.5, fontWeight: 700 }}>管理者</span>
                        )}
                        <span style={{ color: 'var(--ink-soft)', fontSize: 11 }}>{fmtRelative(m.ts)}</span>
                        {mine && !m.deleted && <span style={{ color: 'var(--ink-soft)', fontSize: 10.5 }}>（自分）</span>}
                      </div>

                      {m.deleted ? (
                        <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4, fontStyle: 'italic' }}>
                          このコメントは削除されました
                        </div>
                      ) : (
                        <>
                          {m.reply && (
                            <div
                              onClick={() => scrollToMessage(m.reply.id)}
                              style={{
                                cursor: 'pointer', background: 'var(--panel-alt)', border: '1px solid var(--line)',
                                borderLeft: '3px solid var(--owner)', borderRadius: 4, padding: '4px 8px',
                                marginTop: 5, fontSize: 12,
                              }}
                            >
                              <span style={{ color: 'var(--link)', fontWeight: 700 }}>{m.reply.nickname}</span>
                              <span style={{ color: 'var(--ink-soft)', marginLeft: 6 }}>{m.reply.text}</span>
                            </div>
                          )}

                          {m.text && (
                            <div style={{ fontSize: 13.5, color: 'var(--ink)', marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>
                              <MessageText text={m.text} onJump={scrollToMessage} />
                            </div>
                          )}

                          {renderAttachment(m)}

                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                            <button className="sc-action-link" onClick={() => startReply(m)}>
                              <CornerUpLeft size={11} /> 返信する
                            </button>
                            <button className="sc-action-link" onClick={() => copyMsgId(m.id)}>
                              <Link2 size={11} /> {copiedMsgId === m.id ? 'コピーしました' : 'IDをコピー'}
                            </button>
                            {canDelete && (
                              <button className="sc-action-link danger" onClick={() => deleteMessage(m)}>
                                <Trash2 size={11} /> 削除する
                              </button>
                            )}
                            {messageReaders.length > 0 && (
                              <button className="sc-action-link" onClick={() => toggleReadExpand(m.id)}>
                                <Eye size={11} /> 既読{messageReaders.length}
                              </button>
                            )}
                          </div>
                          {expandedReads.has(m.id) && messageReaders.length > 0 && (
                            <div style={{ fontSize: 10.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                              既読: {messageReaders.map((r) => r.nickname).join('、')}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {typingUsers.length > 0 && (
            <div style={{ padding: '0 14px', fontSize: 11, color: 'var(--ink-soft)', flexShrink: 0 }}>
              {typingUsers.map((t) => t.nickname).join('、')}さんが入力中…
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--line)', padding: '12px 14px', flexShrink: 0, background: 'var(--panel-alt)', position: 'relative' }}>
            {replyTo && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--line)',
                borderLeft: '3px solid var(--owner)', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 12,
              }}>
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: 'var(--link)', fontWeight: 700 }}>{replyTo.nickname}</span>
                  <span style={{ color: 'var(--ink-soft)', marginLeft: 6 }}>への返信: {replyTo.text}</span>
                </div>
                <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', display: 'flex', flexShrink: 0 }}>
                  <X size={14} />
                </button>
              </div>
            )}

            {pendingAttachment && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--line)', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
                {pendingAttachment.kind === 'image' ? (
                  <img src={pendingAttachment.dataUrl} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                ) : (
                  <Paperclip size={14} style={{ color: 'var(--ink-soft)', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pendingAttachment.name} <span style={{ color: 'var(--ink-soft)' }}>({formatSize(pendingAttachment.size)})</span>
                </div>
                <button onClick={() => setPendingAttachment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', display: 'flex', flexShrink: 0 }}>
                  <X size={14} />
                </button>
              </div>
            )}

            {stampPickerOpen && (
              <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-strong)' }}>マイスタンプ（{myStamps.length}/{MAX_STAMPS}）</div>
                  <button className="sc-action-link" onClick={() => stampFileInputRef.current?.click()} disabled={stampUploading}>
                    {stampUploading ? <Loader2 className="animate-spin" size={11} /> : <Plus size={11} />} 作成
                  </button>
                </div>
                {myStamps.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>まだスタンプがありません。画像をアップロードして作成しましょう。</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                    {myStamps.map((s) => (
                      <div key={s.id} style={{ position: 'relative' }}>
                        <button
                          onClick={() => sendStamp(s)}
                          style={{ width: '100%', aspectRatio: '1', background: 'var(--panel-alt)', border: '1px solid var(--line)', borderRadius: 6, cursor: 'pointer', overflow: 'hidden', padding: 0 }}
                        >
                          {fileCache[s.fileId] && <img src={fileCache[s.fileId]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                        </button>
                        <button
                          onClick={() => deleteStamp(s.id)}
                          title="削除"
                          style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: 'var(--danger)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <X size={9} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {symbolPickerOpen && (
              <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 8, padding: 10, marginBottom: 8, display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 4 }}>
                {SYMBOL_CHOICES.map((s, i) => (
                  <button key={i} className="sc-emoji-btn" onClick={() => insertSymbol(s)}>{s}</button>
                ))}
              </div>
            )}

            {(error || attachError) && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 6 }}>{error || attachError}</div>}

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={onPickFile} accept="image/*,.pdf,.txt,.csv,.json,.md,.zip,.doc,.docx,.xlsx,.pptx" />
              <input type="file" ref={stampFileInputRef} style={{ display: 'none' }} onChange={onPickStampFile} accept="image/*" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={attaching}
                title="ファイルを添付"
                style={{
                  background: '#fff', border: '1px solid var(--line)', borderRadius: 8,
                  width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--ink-soft)', cursor: 'pointer', flexShrink: 0,
                }}
              >
                {attaching ? <Loader2 className="animate-spin" size={15} /> : <Paperclip size={15} />}
              </button>
              <button
                type="button"
                onClick={() => { setStampPickerOpen((v) => !v); setSymbolPickerOpen(false); }}
                title="スタンプ"
                style={{
                  background: stampPickerOpen ? 'var(--panel-alt)' : '#fff', border: '1px solid var(--line)', borderRadius: 8,
                  width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--ink-soft)', cursor: 'pointer', flexShrink: 0,
                }}
              >
                <Sticker size={15} />
              </button>
              <button
                type="button"
                onClick={() => { setSymbolPickerOpen((v) => !v); setStampPickerOpen(false); }}
                title="記号・絵文字"
                style={{
                  background: symbolPickerOpen ? 'var(--panel-alt)' : '#fff', border: '1px solid var(--line)', borderRadius: 8,
                  width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--ink-soft)', cursor: 'pointer', flexShrink: 0,
                }}
              >
                <Smile size={15} />
              </button>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  ref={messageInputRef}
                  className="sc-input w-full rounded-lg px-3 py-2 text-sm"
                  style={{ paddingRight: 56 }}
                  placeholder="コメントを追加"
                  maxLength={COMMENT_MAX_LEN}
                  value={draft}
                  onChange={onDraftChange}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
                />
                <span style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 10.5, color: draft.length > COMMENT_MAX_LEN - 30 ? 'var(--danger)' : 'var(--ink-soft)',
                  fontFamily: "'JetBrains Mono', monospace", pointerEvents: 'none',
                }}>
                  {draft.length}/{COMMENT_MAX_LEN}
                </span>
              </div>
              <button
                className="sc-btn-primary sc-post-btn"
                disabled={(!draft.trim() && !pendingAttachment) || sending}
                onClick={sendMessage}
              >
                {sending ? <Loader2 className="animate-spin" size={14} /> : '投稿する'}
              </button>
            </div>
          </div>
        </>
      )}

      {view === 'dm-list' && (
        <>
          <div style={{ background: 'var(--owner)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ width: 30, height: 30, borderRadius: 6, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageCircle size={16} color="#fff" />
            </div>
            <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 17, margin: 0, color: '#fff' }}>ダイレクトメッセージ</h1>
          </div>
          <div style={{ padding: '14px 18px 0', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="sc-input flex-1 rounded-lg px-3 py-2 text-sm"
                placeholder="相手の個人IDを入力してDMを開始"
                value={dmStartIdInput}
                onChange={(e) => setDmStartIdInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') startDmById(); }}
              />
              <button className="sc-btn-primary rounded-lg px-4 text-sm" disabled={!dmStartIdInput.trim()} onClick={startDmById}>開始</button>
            </div>
            {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{error}</div>}
          </div>
          <div className="sc-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
            {dmThreadsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-soft)', fontSize: 13 }}>
                <Loader2 className="animate-spin" size={16} /> 読み込み中…
              </div>
            ) : dmThreads.length === 0 ? (
              <p style={{ color: 'var(--ink-soft)', fontSize: 13, lineHeight: 1.7 }}>まだDMがありません。相手の個人IDを入力して始めましょう。</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dmThreads.map((t) => {
                  const unread = t.lastSenderId && t.lastSenderId !== userId && t.lastTs > (dmReadMap[dmKey(userId, t.peerId)] || 0);
                  return (
                  <button key={t.peerId} className="sc-feed-btn" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10 }} onClick={() => openDmWith(t.peerId, t.peerNickname)}>
                    <Avatar userId={t.peerId} nickname={t.peerNickname} profiles={profiles} avatarCache={avatarCache} size={36} isOnline={isUserOnline(t.peerId)} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: unread ? 800 : 700, fontSize: 13, color: 'var(--ink-strong)' }}>{t.peerNickname}</div>
                      <div style={{ fontSize: 11.5, color: unread ? 'var(--ink-strong)' : 'var(--ink-soft)', fontWeight: unread ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.lastMessage}</div>
                    </div>
                    {unread && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', flexShrink: 0 }} />}
                    <div style={{ fontSize: 10, color: 'var(--ink-soft)', flexShrink: 0 }}>{fmtRelative(t.lastTs)}</div>
                  </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {view === 'dm-thread' && activeDmPeer && (
        <>
          <div style={{ background: 'var(--owner)', padding: '12px 16px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => { clearInterval(dmPollRef.current); setView('dm-list'); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}>
              <ArrowLeft size={20} />
            </button>
            <Avatar userId={activeDmPeer.userId} nickname={activeDmPeer.nickname} profiles={profiles} avatarCache={avatarCache} size={26} isOnline={isUserOnline(activeDmPeer.userId)} onClick={() => openViewProfile(activeDmPeer.userId, activeDmPeer.nickname)} />
            <div style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>{activeDmPeer.nickname}</div>
          </div>
          <div style={{ padding: '6px 14px', fontSize: 10, color: 'var(--ink-soft)', background: '#FBF3E2', borderBottom: '1px solid var(--line)', display: 'flex', gap: 6, alignItems: 'center' }}>
            <Info size={11} /> 運営（チャット管理者）はモデレーション目的でこのDMを確認できる場合があります。
          </div>
          <div className="sc-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
            {dmMessages.length === 0 ? (
              <div style={{ color: 'var(--ink-soft)', fontSize: 13, textAlign: 'center', marginTop: 30 }}>まだメッセージがありません。</div>
            ) : (
              dmMessages.map((m, idx) => {
                const mine = m.fromId === userId;
                const isLastMine = mine && idx === dmMessages.length - 1;
                return (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                    <div style={{
                      maxWidth: '75%', background: mine ? 'var(--owner)' : 'var(--panel)', color: mine ? '#fff' : 'var(--ink)',
                      border: mine ? 'none' : '1px solid var(--line)', borderRadius: 10, padding: '7px 11px', fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {renderRichText(m.text)}
                      {renderAttachment(m)}
                      <div style={{ fontSize: 9.5, opacity: 0.75, marginTop: 3 }}>{fmtRelative(m.ts)}</div>
                    </div>
                    {isLastMine && dmPeerReadAt >= m.ts && (
                      <div style={{ fontSize: 9.5, color: 'var(--ink-soft)', marginTop: 2 }}>既読</div>
                    )}
                  </div>
                );
              })
            )}
            {dmPeerTyping && (
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontStyle: 'italic', marginTop: 2 }}>
                {activeDmPeer.nickname}さんが入力中…
              </div>
            )}
          </div>
          <div style={{ borderTop: '1px solid var(--line)', flexShrink: 0, background: 'var(--panel-alt)' }}>
            {dmAttachError && (
              <div style={{ padding: '4px 14px 0', fontSize: 10.5, color: 'var(--danger-deep)' }}>{dmAttachError}</div>
            )}
            {dmPendingAttachment && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px 0' }}>
                {dmPendingAttachment.kind === 'image' ? (
                  <img src={dmPendingAttachment.dataUrl} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                ) : (
                  <Paperclip size={16} style={{ flexShrink: 0 }} />
                )}
                <div style={{ fontSize: 11.5, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {dmPendingAttachment.name} <span style={{ color: 'var(--ink-soft)' }}>({formatSize(dmPendingAttachment.size)})</span>
                </div>
                <button onClick={() => setDmPendingAttachment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)' }}>
                  <X size={14} />
                </button>
              </div>
            )}
            <div style={{ padding: '10px 14px', display: 'flex', gap: 8 }}>
              <input type="file" ref={dmFileInputRef} style={{ display: 'none' }} onChange={onPickDmFile} />
              <button className="sc-icon-btn" onClick={() => dmFileInputRef.current?.click()} disabled={dmAttaching} title="ファイルを添付">
                {dmAttaching ? <Loader2 className="animate-spin" size={16} /> : <Paperclip size={16} />}
              </button>
              <input
                className="sc-input flex-1 rounded-lg px-3 py-2 text-sm"
                placeholder="メッセージを入力"
                maxLength={COMMENT_MAX_LEN}
                value={dmDraft}
                onChange={(e) => {
                  setDmDraft(e.target.value);
                  if (!activeDmPeer) return;
                  const now = Date.now();
                  if (now - lastDmTypingSentRef.current > 1500) {
                    lastDmTypingSentRef.current = now;
                    sendTypingBeat('dm:' + dmKey(userId, activeDmPeer.userId), userId, nickname);
                  }
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') sendDm(); }}
              />
              <button className="sc-btn-primary sc-post-btn" disabled={(!dmDraft.trim() && !dmPendingAttachment) || dmSending} onClick={sendDm}>
                {dmSending ? <Loader2 className="animate-spin" size={14} /> : '送信'}
              </button>
            </div>
          </div>
        </>
      )}

      {view === 'dm-monitor' && (
        <>
          <div style={{ background: 'var(--owner)', padding: '12px 16px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setView('room')} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}>
              <ArrowLeft size={20} />
            </button>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={16} /> DM監視（管理者専用）
            </div>
          </div>
          <div style={{ padding: '8px 14px', fontSize: 10.5, color: 'var(--ink-soft)', background: '#FBF3E2', borderBottom: '1px solid var(--line)', display: 'flex', gap: 6, alignItems: 'center' }}>
            <Info size={12} /> チャット管理者として、全ユーザーのDMを確認できます。
          </div>
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <div className="sc-scroll" style={{ width: 150, borderRight: '1px solid var(--line)', overflowY: 'auto', flexShrink: 0 }}>
              {dmMonitorThreads.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', padding: 10 }}>DMはまだありません。</div>
              ) : (
                dmMonitorThreads.map((t) => (
                  <button
                    key={t.pairKey}
                    onClick={() => openDmMonitorThread(t)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', background: dmMonitorSelected && dmMonitorSelected.pairKey === t.pairKey ? 'var(--panel-alt)' : 'transparent',
                      border: 'none', borderBottom: '1px solid var(--line)', cursor: 'pointer', fontSize: 10.5,
                    }}
                  >
                    <div style={{ fontWeight: 700, color: 'var(--ink-strong)' }}>{t.nicknameA} ↔ {t.nicknameB}</div>
                    <div style={{ color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.lastMessage}</div>
                  </button>
                ))
              )}
            </div>
            <div className="sc-scroll" style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
              {!dmMonitorSelected ? (
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>左のリストからDMスレッドを選んでください。</div>
              ) : dmMonitorMessages.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>メッセージがありません。</div>
              ) : (
                dmMonitorMessages.map((m) => (
                  <div key={m.id} style={{ marginBottom: 8, fontSize: 12.5 }}>
                    <span style={{ fontWeight: 700, color: 'var(--link)' }}>{m.fromNickname}</span>
                    <span style={{ color: 'var(--ink-soft)', marginLeft: 6, fontSize: 10 }}>{fmtRelative(m.ts)}</span>
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 2 }}>{renderRichText(m.text)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {view === 'notifications' && (
        <>
          <div style={{ background: 'var(--owner)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button onClick={() => setView('lobby')} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}>
              <ArrowLeft size={18} />
            </button>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>通知</div>
          </div>
          <div className="sc-scroll" style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
            {notifications.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>まだ通知はありません。メンションされると、ここに表示されます。</div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => goToNotification(n)}
                  className="sc-feed-btn"
                  style={{ display: 'flex', gap: 10, padding: 10, width: '100%', textAlign: 'left', marginBottom: 6 }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--panel-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MessageCircle size={13} color="var(--owner)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--ink-strong)' }}>
                      <span style={{ fontWeight: 700 }}>{n.fromNickname}</span>
                      {n.isAll ? 'さんが全員にメンションしました' : 'さんがメンションしました'}
                      {n.roomName ? `（${n.roomName}）` : n.projectTitle ? `（${n.projectTitle}）` : ''}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.text}</div>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--ink-soft)', flexShrink: 0 }}>{fmtRelative(n.ts)}</div>
                </button>
              ))
            )}
          </div>
        </>
      )}

      {view === 'moments' && (
        <>
          <div style={{ background: 'var(--owner)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 6, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ImageIcon size={16} color="#fff" />
              </div>
              <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 17, margin: 0, color: '#fff' }}>つぶやき・今日の一枚</h1>
            </div>
            <button onClick={() => setMomentComposerOpen((v) => !v)} className="sc-icon-btn active">
              <Plus size={16} />
            </button>
          </div>

          {momentComposerOpen && (
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', background: 'var(--panel-alt)', flexShrink: 0 }}>
              <textarea
                className="sc-input w-full rounded-lg px-3 py-2 text-sm"
                placeholder="いまどうしてる？（ちょっとした一言）"
                maxLength={MOMENT_MAX_LEN}
                rows={2}
                value={momentDraftText}
                onChange={(e) => setMomentDraftText(e.target.value)}
                style={{ resize: 'none' }}
              />
              {momentDraftImage && (
                <div style={{ position: 'relative', marginTop: 8, width: 90 }}>
                  <img src={momentDraftImage.dataUrl} alt="" style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)' }} />
                  <button onClick={() => setMomentDraftImage(null)} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--danger)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={10} />
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <input type="file" ref={momentImageInputRef} style={{ display: 'none' }} onChange={onPickMomentImage} accept="image/*" />
                <button className="sc-action-link" style={{ border: '1px solid var(--line)', borderRadius: 5 }} onClick={() => momentImageInputRef.current?.click()}>
                  <Camera size={12} /> 写真を追加
                </button>
                <button className="sc-btn-primary rounded-full px-4 py-1.5 text-xs" disabled={(!momentDraftText.trim() && !momentDraftImage) || momentPosting} onClick={postMoment}>
                  {momentPosting ? <Loader2 className="animate-spin" size={12} /> : '投稿する'}
                </button>
              </div>
            </div>
          )}

          <div className="sc-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
            {momentsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-soft)', fontSize: 13 }}>
                <Loader2 className="animate-spin" size={16} /> 読み込み中…
              </div>
            ) : moments.length === 0 ? (
              <p style={{ color: 'var(--ink-soft)', fontSize: 13, lineHeight: 1.7 }}>まだ投稿がありません。右上の＋から最初のつぶやきを投稿しましょう。</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {moments.map((m) => (
                  <div
                    key={m.id}
                    id={`moment-${m.id}`}
                    className="sc-card"
                    style={{
                      padding: 12,
                      transition: 'background-color 0.6s ease, box-shadow 0.6s ease',
                      background: highlightMomentId === m.id ? '#FFF4D6' : undefined,
                      boxShadow: highlightMomentId === m.id ? '0 0 0 2px var(--accent)' : undefined,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Avatar userId={m.userId} nickname={m.nickname} profiles={profiles} avatarCache={avatarCache} size={26} isOnline={isUserOnline(m.userId)} onClick={() => openViewProfile(m.userId, m.nickname)} />
                      <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--ink-strong)' }}>{m.nickname}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--ink-soft)' }}>{fmtRelative(m.ts)}</div>
                      <button className="sc-action-link" style={{ marginLeft: 'auto' }} onClick={() => copyMomentLink(m.id)} title="このつぶやきのURLをコピー">
                        <Link2 size={11} /> {copiedMomentId === m.id ? 'コピーしました' : 'リンク'}
                      </button>
                      {(m.userId === userId || siteAdminUnlocked) && (
                        <button className="sc-action-link danger" onClick={() => deleteMoment(m.id)}>
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                    {m.text && <div style={{ fontSize: 13, color: 'var(--ink)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: m.imageFileId ? 8 : 0 }}>{renderRichText(m.text)}</div>}
                    {m.imageFileId && (
                      fileCache[m.imageFileId] ? (
                        <img src={fileCache[m.imageFileId]} alt="" onClick={() => setLightbox(fileCache[m.imageFileId])} style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 8, cursor: 'zoom-in' }} />
                      ) : (
                        <div style={{ width: '100%', height: 140, background: 'var(--panel-alt)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Loader2 className="animate-spin" size={16} style={{ color: 'var(--ink-soft)' }} />
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {view === 'projects' && (
        <>
          <div style={{ background: 'var(--owner)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 6, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LayoutGrid size={16} color="#fff" />
              </div>
              <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 17, margin: 0, color: '#fff' }}>プロジェクト</h1>
            </div>
            <button onClick={() => setProjectComposerOpen((v) => !v)} className="sc-icon-btn active">
              <Plus size={16} />
            </button>
          </div>

          {projectComposerOpen && (
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', background: 'var(--panel-alt)', flexShrink: 0 }}>
              <input
                className="sc-input w-full rounded-lg px-3 py-2 text-sm mb-2"
                placeholder="プロジェクト名"
                maxLength={40}
                value={projectTitleDraft}
                onChange={(e) => setProjectTitleDraft(e.target.value)}
              />
              <textarea
                className="sc-input w-full rounded-lg px-3 py-2 text-sm"
                placeholder="説明（どんな作品か紹介しましょう）"
                maxLength={400}
                rows={2}
                value={projectDescDraft}
                onChange={(e) => setProjectDescDraft(e.target.value)}
                style={{ resize: 'none' }}
              />
              {projectImageDraft && (
                <div style={{ position: 'relative', marginTop: 8, width: 110 }}>
                  <img src={projectImageDraft.dataUrl} alt="" style={{ width: 110, height: 110, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)' }} />
                  <button onClick={() => setProjectImageDraft(null)} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--danger)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={10} />
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <input type="file" ref={projectImageInputRef} style={{ display: 'none' }} onChange={onPickProjectImage} accept="image/*" />
                <button className="sc-action-link" style={{ border: '1px solid var(--line)', borderRadius: 5 }} onClick={() => projectImageInputRef.current?.click()}>
                  <Camera size={12} /> サムネイル画像を追加
                </button>
                <button className="sc-btn-primary rounded-full px-4 py-1.5 text-xs" disabled={!projectTitleDraft.trim() || !projectImageDraft || projectPosting} onClick={postProject}>
                  {projectPosting ? <Loader2 className="animate-spin" size={12} /> : '公開する'}
                </button>
              </div>
            </div>
          )}

          <div className="sc-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
            {projectsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-soft)', fontSize: 13 }}>
                <Loader2 className="animate-spin" size={16} /> 読み込み中…
              </div>
            ) : projects.length === 0 ? (
              <p style={{ color: 'var(--ink-soft)', fontSize: 13, lineHeight: 1.7 }}>まだプロジェクトがありません。右上の＋から作品を共有しましょう。</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                {projects.map((p) => (
                  <button key={p.id} className="sc-feed-btn" onClick={() => openProject(p)}>
                    <div style={{ height: 100, background: 'var(--panel-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {fileCache[p.imageFileId] ? (
                        <img src={fileCache[p.imageFileId]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Loader2 className="animate-spin" size={16} style={{ color: 'var(--ink-soft)' }} />
                      )}
                    </div>
                    <div style={{ padding: '8px 10px' }}>
                      <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--ink-strong)', marginBottom: 3, wordBreak: 'break-word' }}>{p.title}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{p.authorNickname}・コメント{p.commentCount || 0}件</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {view === 'project-detail' && activeProject && (
        <>
          <div style={{ background: 'var(--owner)', padding: '12px 16px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setView('projects')} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}>
              <ArrowLeft size={20} />
            </button>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', wordBreak: 'break-word' }}>{activeProject.title}</div>
            {(activeProject.authorId === userId || siteAdminUnlocked) && (
              <>
                <input type="file" ref={projectImageEditInputRef} style={{ display: 'none' }} onChange={onPickProjectImageEdit} accept="image/*" />
                <button className="sc-icon-btn" style={{ marginLeft: 'auto' }} title="画像を差し替える" onClick={() => projectImageEditInputRef.current?.click()} disabled={projectImageUpdating}>
                  {projectImageUpdating ? <Loader2 className="animate-spin" size={14} /> : <Camera size={14} />}
                </button>
                <button className="sc-icon-btn" title="削除する" onClick={() => { deleteProject(activeProject.id); setView('projects'); }}>
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
          <div className="sc-scroll" style={{ flex: 1, overflowY: 'auto' }}>
            {fileCache[activeProject.imageFileId] && (
              <img src={fileCache[activeProject.imageFileId]} alt="" onClick={() => setLightbox(fileCache[activeProject.imageFileId])} style={{ width: '100%', maxHeight: 260, objectFit: 'cover', cursor: 'zoom-in' }} />
            )}
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Avatar userId={activeProject.authorId} nickname={activeProject.authorNickname} profiles={profiles} avatarCache={avatarCache} size={26} onClick={() => openViewProfile(activeProject.authorId, activeProject.authorNickname)} />
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-strong)' }}>{activeProject.authorNickname}</div>
                <div style={{ fontSize: 10.5, color: 'var(--ink-soft)' }}>{fmtRelative(activeProject.ts)}</div>
              </div>
              {editingProjectDesc ? (
                <div style={{ marginBottom: 16 }}>
                  <textarea
                    className="sc-input rounded-lg px-3 py-2 text-sm"
                    style={{ width: '100%', boxSizing: 'border-box', minHeight: 80, resize: 'vertical' }}
                    value={projectDescEditDraft}
                    maxLength={2000}
                    onChange={(e) => setProjectDescEditDraft(e.target.value)}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button className="sc-action-link" style={{ border: '1px solid var(--owner)', color: 'var(--owner)', borderRadius: 5, padding: '4px 10px' }} onClick={async () => { await updateProjectDescription(activeProject, projectDescEditDraft.trim()); setEditingProjectDesc(false); }}>
                      保存
                    </button>
                    <button className="sc-action-link" style={{ border: '1px solid var(--line)', borderRadius: 5, padding: '4px 10px' }} onClick={() => setEditingProjectDesc(false)}>
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {activeProject.description && (
                    <div style={{ fontSize: 13, color: 'var(--ink)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.7, marginBottom: 8 }}>{renderRichText(activeProject.description)}</div>
                  )}
                  {(activeProject.authorId === userId || siteAdminUnlocked) && (
                    <button
                      className="sc-action-link"
                      style={{ marginBottom: 16, color: 'var(--ink-soft)' }}
                      onClick={() => { setProjectDescEditDraft(activeProject.description || ''); setEditingProjectDesc(true); }}
                    >
                      <Edit3 size={11} /> 説明を編集
                    </button>
                  )}
                </>
              )}
              <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--line)', paddingTop: 12, marginBottom: 10 }}>
                <button
                  onClick={() => setProjectDetailTab('comments')}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 6, border: '1px solid var(--line)', cursor: 'pointer',
                    background: projectDetailTab === 'comments' ? 'var(--owner)' : 'var(--panel)',
                    color: projectDetailTab === 'comments' ? '#fff' : 'var(--ink-soft)', fontWeight: 700, fontSize: 12,
                  }}
                >
                  コメント（{projectComments.length}）
                </button>
                <button
                  onClick={() => setProjectDetailTab('chat')}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 6, border: '1px solid var(--line)', cursor: 'pointer',
                    background: projectDetailTab === 'chat' ? 'var(--owner)' : 'var(--panel)',
                    color: projectDetailTab === 'chat' ? '#fff' : 'var(--ink-soft)', fontWeight: 700, fontSize: 12,
                  }}
                >
                  チャット
                </button>
              </div>
              {projectDetailTab === 'comments' ? (
              <>
              {projectComments.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>まだコメントがありません。</div>
              ) : (
                projectComments.map((c) => (
                  <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <Avatar userId={c.userId} nickname={c.nickname} profiles={profiles} avatarCache={avatarCache} size={24} onClick={() => openViewProfile(c.userId, c.nickname)} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--link)' }}>{c.nickname}</span>
                        <span style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{fmtRelative(c.ts)}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{renderRichText(c.text)}</div>
                    </div>
                  </div>
                ))
              )}
              </>
              ) : (
              <>
                {projectChatMessages.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>まだチャットがありません。最初のメッセージを送ってみましょう。</div>
                ) : (
                  projectChatMessages.map((m) => (
                    <div key={m.id} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <Avatar userId={m.userId} nickname={m.nickname} profiles={profiles} avatarCache={avatarCache} size={24} isOnline={isUserOnline(m.userId)} onClick={() => openViewProfile(m.userId, m.nickname)} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--link)' }}>{m.nickname}</span>
                          <span style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{fmtRelative(m.ts)}</span>
                          {(m.userId === userId || siteAdminUnlocked) && !m.deleted && (
                            <button className="sc-action-link danger" style={{ marginLeft: 'auto' }} onClick={() => deleteProjectChatMessage(m.id)}>
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                        <div style={{ fontSize: 12.5, color: m.deleted ? 'var(--ink-soft)' : 'var(--ink)', fontStyle: m.deleted ? 'italic' : 'normal', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {m.deleted ? '(削除されたメッセージ)' : m.text}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {projectChatTypingUsers.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontStyle: 'italic', marginTop: 2 }}>
                    {projectChatTypingUsers.map((t) => t.nickname).join('、')}さんが入力中…
                  </div>
                )}
                <div ref={projectChatEndRef} />
              </>
              )}
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--line)', padding: '10px 14px', flexShrink: 0, background: 'var(--panel-alt)', display: 'flex', gap: 8 }}>
            {projectDetailTab === 'comments' ? (
              <>
                <input
                  className="sc-input flex-1 rounded-lg px-3 py-2 text-sm"
                  placeholder="コメントを追加"
                  maxLength={COMMENT_MAX_LEN}
                  value={projectCommentDraft}
                  onChange={(e) => setProjectCommentDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') postProjectComment(); }}
                />
                <button className="sc-btn-primary sc-post-btn" disabled={!projectCommentDraft.trim() || projectCommentSending} onClick={postProjectComment}>
                  {projectCommentSending ? <Loader2 className="animate-spin" size={14} /> : '送信'}
                </button>
              </>
            ) : (
              <>
                <input
                  className="sc-input flex-1 rounded-lg px-3 py-2 text-sm"
                  placeholder="チャットにメッセージを送る"
                  maxLength={COMMENT_MAX_LEN}
                  value={projectChatDraft}
                  onChange={(e) => {
                    setProjectChatDraft(e.target.value);
                    if (!activeProject) return;
                    const now = Date.now();
                    if (now - lastProjectTypingSentRef.current > 1500) {
                      lastProjectTypingSentRef.current = now;
                      sendTypingBeat('project:' + activeProject.id, userId, nickname);
                    }
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendProjectChatMessage(); }}
                />
                <button className="sc-btn-primary sc-post-btn" disabled={!projectChatDraft.trim() || projectChatSending} onClick={sendProjectChatMessage}>
                  {projectChatSending ? <Loader2 className="animate-spin" size={14} /> : '送信'}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {showTabBar && (
        <div style={{ display: 'flex', alignItems: 'center', borderTop: '1px solid var(--line)', background: 'var(--panel)', flexShrink: 0 }}>
          <div style={{ display: 'flex', flex: 1 }}>
            <button className={`sc-tab-btn ${view === 'lobby' ? 'active' : ''}`} onClick={() => switchTab('lobby')} style={{ position: 'relative', ...(tabBarCompact ? { padding: '6px 0' } : {}) }}>
              <Home size={tabBarCompact ? 16 : 18} />{!tabBarCompact && <span style={{ fontSize: 9.5, fontWeight: 700 }}>スタジオ</span>}
              {roomsUnreadCount > 0 && (
                <span style={{ position: 'absolute', top: 2, right: '28%', minWidth: 14, height: 14, padding: '0 3px', borderRadius: 7, background: 'var(--danger)', color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {roomsUnreadCount > 9 ? '9+' : roomsUnreadCount}
                </span>
              )}
            </button>
            <button className={`sc-tab-btn ${view === 'dm-list' ? 'active' : ''}`} onClick={() => switchTab('dm-list')} style={{ position: 'relative', ...(tabBarCompact ? { padding: '6px 0' } : {}) }}>
              <MessageCircle size={tabBarCompact ? 16 : 18} />{!tabBarCompact && <span style={{ fontSize: 9.5, fontWeight: 700 }}>DM</span>}
              {dmUnreadCount > 0 && (
                <span style={{ position: 'absolute', top: 2, right: '28%', minWidth: 14, height: 14, padding: '0 3px', borderRadius: 7, background: 'var(--danger)', color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {dmUnreadCount > 9 ? '9+' : dmUnreadCount}
                </span>
              )}
            </button>
            <button className={`sc-tab-btn ${view === 'moments' ? 'active' : ''}`} onClick={() => switchTab('moments')} style={{ position: 'relative', ...(tabBarCompact ? { padding: '6px 0' } : {}) }}>
              <ImageIcon size={tabBarCompact ? 16 : 18} />{!tabBarCompact && <span style={{ fontSize: 9.5, fontWeight: 700 }}>つぶやき</span>}
              {hasNewMoments && (
                <span style={{ position: 'absolute', top: 4, right: '30%', width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)' }} />
              )}
            </button>
            <button className={`sc-tab-btn ${view === 'projects' ? 'active' : ''}`} onClick={() => switchTab('projects')} style={{ position: 'relative', ...(tabBarCompact ? { padding: '6px 0' } : {}) }}>
              <LayoutGrid size={tabBarCompact ? 16 : 18} />{!tabBarCompact && <span style={{ fontSize: 9.5, fontWeight: 700 }}>プロジェクト</span>}
              {hasNewProjects && (
                <span style={{ position: 'absolute', top: 4, right: '30%', width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)' }} />
              )}
            </button>
          </div>
          <button
            title={tabBarCompact ? '元の大きさに戻す' : '小さくする'}
            onClick={() => setTabBarCompact((v) => !v)}
            style={{ background: 'none', border: 'none', borderLeft: '1px solid var(--line)', color: 'var(--ink-soft)', cursor: 'pointer', padding: '0 8px', height: tabBarCompact ? 30 : 46, display: 'flex', alignItems: 'center' }}
          >
            {tabBarCompact ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
          </button>
        </div>
      )}

      {profileModalOpen && (
        <div className="sc-modal-overlay" onClick={() => setProfileModalOpen(false)}>
          <div className="sc-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink-strong)' }}>プロフィール設定</div>
              <button onClick={() => setProfileModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', display: 'flex' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ position: 'relative' }}>
                <Avatar
                  userId={userId} nickname={profileNicknameDraft || nickname}
                  profiles={{ [userId]: { icon: profileIconDraft, color: profileColorDraft, avatarFileId: profileAvatarFileId } }}
                  avatarCache={avatarCache} size={52}
                />
                <button
                  onClick={() => avatarFileInputRef.current?.click()}
                  title="画像をアップロード"
                  style={{ position: 'absolute', bottom: -4, right: -4, width: 20, height: 20, borderRadius: '50%', background: 'var(--owner)', color: '#fff', border: '2px solid var(--panel)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {profileAvatarUploading ? <Loader2 className="animate-spin" size={10} /> : <Camera size={10} />}
                </button>
                <input type="file" ref={avatarFileInputRef} style={{ display: 'none' }} onChange={onPickAvatarFile} accept="image/*" />
              </div>
              <div style={{ flex: 1 }}>
                <input
                  className="sc-input w-full rounded-lg px-3 py-2 text-sm mb-1"
                  placeholder="ニックネーム"
                  maxLength={16}
                  value={profileNicknameDraft}
                  onChange={(e) => setProfileNicknameDraft(e.target.value)}
                />
                {profileAvatarFileId && (
                  <button className="sc-action-link" onClick={() => setProfileAvatarFileId(null)}>画像を削除してアイコンに戻す</button>
                )}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-strong)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Edit3 size={11} /> 自己紹介（ひとこと）
              </div>
              <textarea
                className="sc-input w-full rounded-lg px-3 py-2 text-sm"
                placeholder="よろしくお願いします！"
                maxLength={BIO_MAX_LEN}
                rows={2}
                value={profileBioDraft}
                onChange={(e) => setProfileBioDraft(e.target.value)}
                style={{ resize: 'none' }}
              />
              <div style={{ fontSize: 9.5, color: 'var(--ink-soft)', textAlign: 'right' }}>{profileBioDraft.length}/{BIO_MAX_LEN}</div>
            </div>

            <div style={{ background: 'var(--panel-alt)', border: '1px solid var(--line)', borderRadius: 8, padding: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 }}>
                あなたの個人ID（固定・なりすまし防止用）
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--ink-strong)', flex: 1, wordBreak: 'break-all' }}>
                  {userId}
                </div>
                <button className="sc-action-link" style={{ border: '1px solid var(--line)', borderRadius: 5, flexShrink: 0 }} onClick={copyMyId}>
                  {idCopied ? <Check size={12} /> : <Copy size={12} />} {idCopied ? 'コピー済み' : 'コピー'}
                </button>
              </div>
              <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 6, lineHeight: 1.6 }}>
                このIDをスタジオ管理者に伝えると、プライベートスタジオに招待してもらえます。同じニックネームの人がいても、このIDで本人を区別できます。DMを送るときにも使えます。
              </div>
            </div>

            <div style={{ background: 'var(--panel-alt)', border: '1px solid var(--line)', borderRadius: 8, padding: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <KeyRound size={11} /> チャット管理者
              </div>
              {siteAdminUnlocked ? (
                <>
                  <div style={{ fontSize: 11.5, color: 'var(--owner)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                    <ShieldCheck size={13} /> チャット管理者として有効になっています
                  </div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 4 }}>全体へのお知らせ</div>
                  <textarea
                    className="sc-input rounded-lg px-3 py-2 text-sm"
                    style={{ width: '100%', boxSizing: 'border-box', minHeight: 54, resize: 'vertical' }}
                    placeholder="全ユーザーに表示するお知らせ"
                    maxLength={300}
                    value={announcementDraft}
                    onChange={(e) => setAnnouncementDraft(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button className="sc-action-link" style={{ border: '1px solid var(--owner)', color: 'var(--owner)', borderRadius: 5, flex: 1, justifyContent: 'center', padding: '5px 0' }} onClick={postAnnouncement} disabled={!announcementDraft.trim()}>
                      お知らせを出す
                    </button>
                    {announcement && (
                      <button className="sc-action-link" style={{ border: '1px solid var(--line)', borderRadius: 5, flexShrink: 0, padding: '5px 10px' }} onClick={clearAnnouncement}>
                        取り下げる
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="password"
                      className="sc-input flex-1 rounded-lg px-3 py-2 text-sm"
                      placeholder="合言葉を入力"
                      value={adminPassInput}
                      onChange={(e) => { setAdminPassInput(e.target.value); setAdminPassError(''); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') unlockSiteAdmin(); }}
                    />
                    <button className="sc-action-link" style={{ border: '1px solid var(--line)', borderRadius: 5, flexShrink: 0 }} onClick={unlockSiteAdmin}>
                      解除
                    </button>
                  </div>
                  {adminPassError && (
                    <div style={{ fontSize: 10.5, color: 'var(--danger-deep)', marginTop: 4 }}>{adminPassError}</div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 6, lineHeight: 1.6 }}>
                    正しい合言葉を知っている人だけが使える機能です。通常は入力不要です。
                  </div>
                </>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-strong)', marginBottom: 6 }}>アイコンを選ぶ（画像未設定時）</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6 }}>
                <button
                  className={`sc-emoji-btn ${!profileIconDraft ? 'selected' : ''}`}
                  onClick={() => setProfileIconDraft(null)}
                  title="なし（イニシャル表示）"
                  style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft)' }}
                >
                  なし
                </button>
                {ICON_CHOICES.map((ic) => (
                  <button key={ic} className={`sc-emoji-btn ${profileIconDraft === ic ? 'selected' : ''}`} onClick={() => { setProfileIconDraft(ic); setProfileAvatarFileId(null); }}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-strong)', marginBottom: 6 }}>カラーを選ぶ</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {AVATAR_COLORS.map((c) => (
                  <button key={c} className={`sc-swatch ${profileColorDraft === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => setProfileColorDraft(c)} />
                ))}
              </div>
            </div>

            <button className="sc-btn-primary w-full rounded-full py-2.5 text-sm" style={{ fontWeight: 700 }} onClick={saveProfileChanges}>
              保存する
            </button>
          </div>
        </div>
      )}

      {viewProfileTarget && (
        <div className="sc-modal-overlay" onClick={() => setViewProfileTarget(null)}>
          <div className="sc-modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
              <button onClick={() => setViewProfileTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', display: 'flex' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              <Avatar userId={viewProfileTarget.userId} nickname={viewProfileTarget.nickname} profiles={profiles} avatarCache={avatarCache} size={64} isOnline={isUserOnline(viewProfileTarget.userId)} />
            </div>
            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--ink-strong)' }}>{viewProfileTarget.nickname}</div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4, marginBottom: 10 }}>
              <IdTag userId={viewProfileTarget.userId} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink)', background: 'var(--panel-alt)', border: '1px solid var(--line)', borderRadius: 8, padding: 10, minHeight: 20, textAlign: 'left', marginBottom: 14 }}>
              {(profiles[viewProfileTarget.userId] && profiles[viewProfileTarget.userId].bio) || '自己紹介はまだ設定されていません。'}
            </div>
            {viewProfileTarget.userId !== userId && (
              <button
                className="sc-btn-primary w-full rounded-full py-2 text-sm"
                style={{ fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onClick={() => { const t = viewProfileTarget; setViewProfileTarget(null); openDmWith(t.userId, t.nickname); }}
              >
                <MessageCircle size={14} /> DMを送る
              </button>
            )}
          </div>
        </div>
      )}

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'absolute', inset: 0, background: 'rgba(20,18,15,0.82)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 60, cursor: 'zoom-out', padding: 20,
          }}
        >
          <img src={lightbox} alt="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}


function PasswordGate({ onUnlock }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const tryUnlock = () => {
    if (input === SITE_PASSWORD) {
      try { window.localStorage.setItem('studio:site-unlocked', '1'); } catch (e) {}
      onUnlock();
    } else {
      setError('\u6697\u8a3c\u756a\u53f7\u304c\u9055\u3044\u307e\u3059');
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F5F1EA', fontFamily: "'Inter', sans-serif", padding: 20,
    }}>
      <style>{FONT_IMPORT}</style>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 300, maxWidth: '100%', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 14, textAlign: 'center' }}>\u6697\u8a3c\u756a\u53f7\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044</div>
        <input
          type="password"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') tryUnlock(); }}
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 15, marginBottom: 10 }}
          autoFocus
        />
        {error && <div style={{ color: '#c0392b', fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
        <button
          onClick={tryUnlock}
          style={{ width: '100%', padding: '10px 0', borderRadius: 999, border: 'none', background: '#D6393A', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
        >
          \u5165\u308b
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [unlocked, setUnlocked] = useState(() => {
    try { return window.localStorage.getItem('studio:site-unlocked') === '1'; } catch (e) { return false; }
  });
  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  return <StudioComments />;
}
