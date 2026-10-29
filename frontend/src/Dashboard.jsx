
function FolderGridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"></rect>
      <rect x="14" y="3" width="7" height="7"></rect>
      <rect x="14" y="14" width="7" height="7"></rect>
      <rect x="3" y="14" width="7" height="7"></rect>
    </svg>
  )
}

const API_BASE = import.meta.env.VITE_API_URL || ''
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import './Dashboard.css'

// Helper: Format file size
function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '0 KB'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  const kb = bytes / 1024
  return `${kb.toFixed(1)} KB`
}

// Helper: Format relative time
function formatRelativeTime(dateString) {
  if (!dateString) return 'Recently'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'Recently'
  const now = new Date()
  const diffSec = Math.floor((now - date) / 1000)
  if (diffSec < 60) return 'Just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString()
}

// Helper: File type badge
function getFileType(fileName) {
  if (!fileName) return 'FILE'
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.pdf')) return 'PDF'
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) return 'DOCX'
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'IMG'
  return 'FILE'
}


const DOCUMENT_CATEGORIES = [
  {
    name: 'Finance',
    icon: '💰',
    color: '#10b981',
    description: 'Invoices, salary slips and financial records.'
  },
  {
    name: 'HR',
    icon: '👥',
    color: '#6366f1',
    description: 'Resumes, offer letters and employee records.'
  },
  {
    name: 'Legal',
    icon: '⚖️',
    color: '#f59e0b',
    description: 'Contracts, agreements and legal documents.'
  },
  {
    name: 'IT',
    icon: '💻',
    color: '#06b6d4',
    description: 'Technical specs, architecture diagrams and logs.'
  },
  {
    name: 'Education',
    icon: '🎓',
    color: '#8b5cf6',
    description: 'Certificates, course materials and research.'
  },
  {
    name: 'Personal',
    icon: '👤',
    color: '#ec4899',
    description: 'ID proofs, medical records and personal files.'
  }
]

export default function Dashboard({ user, onLogout }) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState('Dashboard')

  // Real data from backend
  const [documents, setDocuments] = useState([])
  const [sharedDocuments, setSharedDocuments] = useState([])
  const [auditLogs, setAuditLogs] = useState([])

  // Loading states
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [loadingShared, setLoadingShared] = useState(false)
  const [loadingAudit, setLoadingAudit] = useState(false)

  // Errors & Messages
  const [docsError, setDocsError] = useState('')
  const [auditError, setAuditError] = useState('')
  const [toastMessage, setToastMessage] = useState(null)

  // Search filter
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [uploadCategory, setUploadCategory] = useState('General')

  // Modals state
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showPermissionsModal, setShowPermissionsModal] = useState(false)
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [activeMenuDocId, setActiveMenuDocId] = useState(null)

  // Upload modal inputs
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  // Share modal inputs
  const [shareDocId, setShareDocId] = useState('')
  const [shareEmail, setShareEmail] = useState('')
  const [shareLoading, setShareLoading] = useState(false)
  const [shareError, setShareError] = useState('')
  const [shareSuccess, setShareSuccess] = useState('')

  // Permissions modal selected doc
  const [permDoc, setPermDoc] = useState(null)
  const [revokingEmail, setRevokingEmail] = useState('')

  // Password update in Settings
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [settingsMessage, setSettingsMessage] = useState('')

  const profileRef = useRef(null)
  const menuRef = useRef(null)

  // Adjustable & Collapsible Sidebar State
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('tv_sidebar_width')
    return saved ? parseInt(saved, 10) : 260
  })
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('tv_sidebar_collapsed') === 'true'
  })
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef(null)

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('tv_sidebar_collapsed', String(next))
      return next
    })
  }

  const startResizing = useCallback((e) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e) => {
      let newWidth = e.clientX
      if (newWidth < 180) newWidth = 180
      if (newWidth > 420) newWidth = 420
      setSidebarWidth(newWidth)
      localStorage.setItem('tv_sidebar_width', String(newWidth))
      if (isSidebarCollapsed) {
        setIsSidebarCollapsed(false)
        localStorage.setItem('tv_sidebar_collapsed', 'false')
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isResizing, isSidebarCollapsed])

  // Dynamic user data from props
  const displayName = user?.name || user?.email?.split('@')[0] || 'User'
  const userRole = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : 'Viewer'
  const isAdmin = user?.role === 'admin'
  const userEmail = user?.email || ''
  const userInitial = (displayName.charAt(0) || 'U').toUpperCase()

  const getToken = () => sessionStorage.getItem('trustvault_token')

  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type })
    setTimeout(() => setToastMessage(null), 3800)
  }

  // Fetch real documents from backend
  const loadDocuments = async () => {
    const token = getToken()
    if (!token) return
    setLoadingDocs(true)
    setDocsError('')

    try {
      const res = await fetch(`${API_BASE}/api/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to load documents')
      setDocuments(Array.isArray(data.documents) ? data.documents : [])
    } catch (err) {
      setDocsError(err.message || 'Could not connect to document service')
    } finally {
      setLoadingDocs(false)
    }
  }

  // Fetch shared documents from backend
  const loadSharedDocuments = async () => {
    const token = getToken()
    if (!token) return
    setLoadingShared(true)

    try {
      const res = await fetch(`${API_BASE}/api/documents/shared-with-me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok && Array.isArray(data.documents)) {
        setSharedDocuments(data.documents)
      }
    } catch {
      // Ignore
    } finally {
      setLoadingShared(false)
    }
  }

  // Fetch audit logs from backend (Admin only)
  const loadAuditLogs = async () => {
    const token = getToken()
    if (!token) return
    setLoadingAudit(true)
    setAuditError('')

    try {
      const res = await fetch(`${API_BASE}/api/documents/audit-logs`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403) {
          setAuditError('Administrator access required for audit logs.')
        } else {
          setAuditError(data.message || 'Could not load audit logs.')
        }
        return
      }
      setAuditLogs(Array.isArray(data.logs) ? data.logs : [])
    } catch (err) {
      setAuditError(err.message || 'Audit log service unavailable.')
    } finally {
      setLoadingAudit(false)
    }
  }

  // Initial load
  useEffect(() => {
    loadDocuments()
    loadSharedDocuments()
    loadAuditLogs()
  }, [])

  // Close menus on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileDropdown(false)
      }
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenuDocId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Real filtered documents
  const filteredDocuments = useMemo(() => {
    let list = documents
    if (selectedCategory && selectedCategory !== 'All') {
      list = list.filter((d) => (d.category || 'General').toLowerCase() === selectedCategory.toLowerCase())
    }
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase()
    return list.filter(
      (d) =>
        (d.title && d.title.toLowerCase().includes(q)) ||
        (d.originalName && d.originalName.toLowerCase().includes(q)),
    )
  }, [documents, searchQuery, selectedCategory])

  // Handle Search Submission (switches to view with documents if elsewhere)
  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault()
    if (activeTab !== 'Dashboard' && activeTab !== 'My Documents') {
      setActiveTab('Dashboard')
    }
  }

  // Handle Document Upload
  const handleUploadSubmit = async (e) => {
    e.preventDefault()
    setUploadError('')

    if (!uploadFile) {
      setUploadError('Please select a file to upload.')
      return
    }

    const title = uploadTitle.trim() || uploadFile.name
    const token = getToken()

    if (!token) {
      setUploadError('Your session has expired. Please sign in again.')
      return
    }

    setUploadLoading(true)

    try {
      const formData = new FormData()
      formData.append('title', title)
      formData.append('description', uploadDescription.trim())
      formData.append('category', uploadCategory)
      formData.append('document', uploadFile)

      const res = await fetch(`${API_BASE}/api/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Document upload failed.')
      }

      showToast('Document uploaded successfully!')
      closeUploadModal()
      await loadDocuments()
      await loadAuditLogs()
    } catch (err) {
      setUploadError(err.message || 'Could not upload document.')
    } finally {
      setUploadLoading(false)
    }
  }

  const closeUploadModal = () => {
    setShowUploadModal(false)
    setUploadTitle('')
    setUploadDescription('')
    setUploadFile(null)
    setUploadError('')
  }

  // Handle Document Download
  const handleDownload = async (doc) => {
    const token = getToken()
    const docId = doc._id || doc.id

    if (!token || !docId) {
      showToast('Session expired or document not found.', 'error')
      return
    }

    try {
      const res = await fetch(`${API_BASE}/api/documents/${encodeURIComponent(docId)}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        let msg = 'Download failed'
        try {
          const d = await res.json()
          msg = d.message || msg
        } catch {
          // not json
        }
        throw new Error(msg)
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = doc.originalName || doc.title || 'document'
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => window.URL.revokeObjectURL(url), 1000)

      showToast(`Downloaded "${doc.originalName || doc.title}"`)
      loadAuditLogs()
    } catch (err) {
      showToast(err.message || 'Failed to download document.', 'error')
    }
  }

  // Handle Share Document
  const handleShareSubmit = async (e) => {
    e.preventDefault()
    setShareError('')
    setShareSuccess('')

    const email = shareEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) {
      setShareError('Enter a valid registered user email.')
      return
    }

    const token = getToken()
    if (!token) {
      setShareError('Session expired. Please sign in again.')
      return
    }

    setShareLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/documents/${encodeURIComponent(shareDocId)}/share`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to share document.')
      }

      setShareSuccess(`Access granted to ${email}`)
      showToast(`Document access granted to ${email}`)
      setShareEmail('')
      await loadDocuments()
      await loadAuditLogs()
      setTimeout(() => setShowShareModal(false), 1200)
    } catch (err) {
      setShareError(err.message || 'Could not share document.')
    } finally {
      setShareLoading(false)
    }
  }

  // Handle Revoke Permission
  const handleRevokePermission = async (docId, email) => {
    const token = getToken()
    if (!token || !docId) return
    setRevokingEmail(email)

    try {
      const res = await fetch(`${API_BASE}/api/documents/${encodeURIComponent(docId)}/revoke`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Could not revoke access.')

      showToast(`Access revoked for ${email}`)
      await loadDocuments()
      await loadAuditLogs()

      // update permDoc state
      setPermDoc((prev) => {
        if (!prev) return null
        return {
          ...prev,
          allowedViewers: (prev.allowedViewers || []).filter((v) => {
            const vEmail = typeof v === 'object' ? v.email : v
            return vEmail !== email
          }),
        }
      })
    } catch (err) {
      showToast(err.message || 'Failed to revoke access.', 'error')
    } finally {
      setRevokingEmail('')
    }
  }

  // Handle Delete Document
  const handleDeleteDocument = async (doc) => {
    const docId = doc._id || doc.id
    const docName = doc.originalName || doc.title
    const confirmDel = window.confirm(`Are you sure you want to delete "${docName}"?`)
    if (!confirmDel) return

    const token = getToken()
    if (!token) return

    try {
      const res = await fetch(`${API_BASE}/api/documents/${encodeURIComponent(docId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to delete document.')

      showToast(`Deleted "${docName}"`)
      setActiveMenuDocId(null)
      await loadDocuments()
      await loadAuditLogs()
    } catch (err) {
      showToast(err.message || 'Could not delete document.', 'error')
    }
  }

  const openShareForDoc = (doc) => {
    setShareDocId(doc._id || doc.id)
    setShareError('')
    setShareSuccess('')
    setShowShareModal(true)
    setActiveMenuDocId(null)
  }

  const openPermissionsForDoc = (doc) => {
    setPermDoc(doc)
    setShowPermissionsModal(true)
    setActiveMenuDocId(null)
  }

  return (
    <div className="dashboard-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`toast-notification toast-${toastMessage.type}`}>
          <div className="toast-icon">
            {toastMessage.type === 'success' ? '✓' : 'ℹ'}
          </div>
          <span>{toastMessage.message}</span>
        </div>
      )}

      {/* ================= LEFT SIDEBAR ================= */}
      <aside
        ref={sidebarRef}
        className={`dashboard-sidebar ${isSidebarCollapsed ? 'collapsed' : ''} ${isResizing ? 'is-resizing' : ''}`}
        style={{
          width: isSidebarCollapsed ? 74 : `${sidebarWidth}px`,
          minWidth: isSidebarCollapsed ? 74 : undefined,
          maxWidth: isSidebarCollapsed ? 74 : undefined,
          transition: isResizing ? 'none' : 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Brand Logo & Collapse Toggle */}
        <div className="sidebar-brand-row">
          <div className="sidebar-brand" title="TrustVault">
            <div className="brand-logo-squircle">
              <span>T</span>
            </div>
            {!isSidebarCollapsed && <span className="brand-title">TrustVault</span>}
          </div>
          <button
            type="button"
            className="sidebar-collapse-toggle-btn"
            onClick={toggleSidebarCollapse}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? '»' : '«'}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          <button
            type="button"
            className={`nav-link ${activeTab === 'Dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('Dashboard')}
            title="Dashboard"
          >
            <span className="nav-icon">
              <HomeIcon />
            </span>
            {!isSidebarCollapsed && <span>Dashboard</span>}
          </button>

          <button
            type="button"
            className={`nav-link ${activeTab === 'My Documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('My Documents')}
            title="My Documents"
          >
            <span className="nav-icon">
              <FileTextIcon />
            </span>
            {!isSidebarCollapsed && <span>My Documents</span>}
          </button>

          <button
            type="button"
            className={`nav-link ${activeTab === 'Categories' ? 'active' : ''}`}
            onClick={() => setActiveTab('Categories')}
            title="Categories"
          >
            <span className="nav-icon">
              <FolderGridIcon />
            </span>
            {!isSidebarCollapsed && <span>Categories</span>}
          </button>

          <button
            type="button"
            className={`nav-link ${activeTab === 'Shared With Me' ? 'active' : ''}`}
            onClick={() => setActiveTab('Shared With Me')}
            title="Shared With Me"
          >
            <span className="nav-icon">
              <UsersIcon />
            </span>
            {!isSidebarCollapsed && <span>Shared With Me</span>}
          </button>

          <button
            type="button"
            className={`nav-link ${activeTab === 'Activity Log' ? 'active' : ''}`}
            onClick={() => setActiveTab('Activity Log')}
            title="Activity Log"
          >
            <span className="nav-icon">
              <ClockIcon />
            </span>
            {!isSidebarCollapsed && <span>Activity Log</span>}
          </button>

          <button
            type="button"
            className={`nav-link ${activeTab === 'Settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('Settings')}
            title="Settings"
          >
            <span className="nav-icon">
              <SettingsIcon />
            </span>
            {!isSidebarCollapsed && <span>Settings</span>}
          </button>
        </nav>

        {/* Sidebar Bottom Area */}
        <div className="sidebar-bottom">
          {/* Security Protection Card */}
          <div
            className="security-card"
            onClick={() => setShowSecurityModal(true)}
            role="button"
            tabIndex={0}
            title="Your vault, protected"
          >
            <div className="security-card-icon">
              <ShieldLockIcon />
            </div>
            {!isSidebarCollapsed && (
              <div className="security-card-content">
                <h4>Your vault, protected</h4>
                <p>Secure • Private • Trusted</p>
              </div>
            )}
          </div>

          {/* Sign Out Button */}
          <button
            type="button"
            className="sidebar-signout-btn"
            onClick={onLogout}
            title="Sign Out"
          >
            <span className="signout-icon">
              <SignOutIcon />
            </span>
            {!isSidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>

        {/* Drag handle for resizing */}
        <div
          className="sidebar-resize-handle"
          onMouseDown={startResizing}
          title="Drag to adjust sidebar width"
        >
          <div className="sidebar-resize-indicator" />
        </div>

        {/* Background wavy curves decoration */}
        {!isSidebarCollapsed && (
          <div className="sidebar-wave-art" aria-hidden="true">
            <svg viewBox="0 0 260 160" fill="none">
              <path
                d="M-20 80 Q 60 140, 160 90 T 300 110"
                stroke="rgba(45, 212, 191, 0.12)"
                strokeWidth="2.5"
              />
              <path
                d="M-10 120 Q 80 60, 180 120 T 320 80"
                stroke="rgba(45, 212, 191, 0.08)"
                strokeWidth="2"
              />
            </svg>
          </div>
        )}
      </aside>

      {/* ================= MAIN DASHBOARD BODY ================= */}
      <main className="dashboard-main-content">
        {/* Top Header Bar */}
        <header className="main-header">
          {/* Left Greeting */}
          <div className="header-greeting-wrap">
            <div className="header-shield-badge">
              <ShieldCheckBadgeIcon />
            </div>
            <div className="header-greeting-text">
              <span className="greeting-time">Good morning,</span>
              <h1 className="greeting-name">Welcome back, {displayName}!</h1>
              <p className="greeting-sub">Your confidential documents are safe with us.</p>
            </div>
          </div>

          {/* Right Search & Profile */}
          <div className="header-actions">
            {/* Search documents */}
            <form className="header-search-form" onSubmit={handleSearchSubmit}>
              <div className="header-search-box">
                <SearchIcon />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search documents"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
                <button
                  type="submit"
                  className="search-action-btn"
                  title="Search documents"
                  aria-label="Search documents"
                >
                  Search
                </button>
              </div>
            </form>

            {/* Profile Avatar Pill */}
            <div className="profile-dropdown-wrapper" ref={profileRef}>
              <button
                type="button"
                className="profile-pill-btn"
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              >
                <div className="avatar-circle">
                  <span>{userInitial}</span>
                </div>
                <div className="profile-details">
                  <span className="profile-name">{displayName}</span>
                  <span className="profile-role">{userRole}</span>
                </div>
                <ChevronDownIcon />
              </button>

              {/* Profile Dropdown Menu */}
              {showProfileDropdown && (
                <div className="profile-menu-popover">
                  <div className="profile-menu-header">
                    <strong>{displayName}</strong>
                    <small>{userEmail}</small>
                    <span className="role-tag-badge">{userRole}</span>
                  </div>
                  <div className="profile-menu-divider" />
                  <button
                    type="button"
                    className="profile-menu-item"
                    onClick={() => {
                      setActiveTab('Settings')
                      setShowProfileDropdown(false)
                    }}
                  >
                    <SettingsIcon />
                    Account Settings
                  </button>
                  <button
                    type="button"
                    className="profile-menu-item"
                    onClick={() => {
                      setShowSecurityModal(true)
                      setShowProfileDropdown(false)
                    }}
                  >
                    <ShieldLockIcon />
                    Security &amp; Encryption
                  </button>
                  <div className="profile-menu-divider" />
                  <button
                    type="button"
                    className="profile-menu-item signout-item"
                    onClick={onLogout}
                  >
                    <SignOutIcon />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Views */}
        {activeTab === 'Dashboard' && (
          <div className="dashboard-scrollable-body">
            {/* Hero Banner Section */}
            <section className="hero-banner-card">
              <div className="banner-left-art">
                <div className="vault-illustration">
                  <svg
                    width="140"
                    height="110"
                    viewBox="0 0 140 110"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Back folder tab */}
                    <path
                      d="M15 32C15 28.6863 17.6863 26 21 26H52L62 36H119C122.314 36 125 38.6863 125 42V88C125 91.3137 122.314 94 119 94H21C17.6863 94 15 91.3137 15 88V32Z"
                      fill="#124954"
                    />
                    {/* File document peeking out */}
                    <rect
                      x="32"
                      y="16"
                      width="68"
                      height="54"
                      rx="4"
                      fill="#E0F7F3"
                      stroke="#A7F3D0"
                      strokeWidth="1.5"
                    />
                    <line x1="42" y1="28" x2="72" y2="28" stroke="#104E5B" strokeWidth="2" strokeLinecap="round" />
                    <line x1="42" y1="36" x2="88" y2="36" stroke="#104E5B" strokeWidth="2" strokeLinecap="round" />
                    <line x1="42" y1="44" x2="80" y2="44" stroke="#104E5B" strokeWidth="2" strokeLinecap="round" />
                    {/* Front folder body */}
                    <path
                      d="M10 44C10 40.6863 12.6863 38 16 38H124C127.314 38 130 40.6863 130 44V92C130 95.3137 127.314 98 124 98H16C12.6863 98 10 95.3137 10 92V44Z"
                      fill="url(#folderGrad)"
                      stroke="#2DD4BF"
                      strokeWidth="1"
                    />
                    {/* Glowing Mint Shield */}
                    <circle cx="70" cy="68" r="24" fill="#0D3B43" fillOpacity="0.8" />
                    <path
                      d="M70 54L84 60V70C84 79 78 86 70 89C62 86 56 79 56 70V60L70 54Z"
                      fill="#14B8A6"
                      stroke="#5EEAD4"
                      strokeWidth="2"
                    />
                    {/* Padlock */}
                    <rect x="66" y="69" width="8" height="7" rx="1.5" fill="#FFFFFF" />
                    <path d="M67.5 69V66.5C67.5 65.1193 68.6193 64 70 64C71.3807 64 72.5 65.1193 72.5 66.5V69" stroke="#FFFFFF" strokeWidth="1.5" />
                    <circle cx="70" cy="72" r="1" fill="#0D3B43" />
                    {/* Sparkles */}
                    <path d="M124 22L126 26L130 28L126 30L124 34L122 30L118 28L122 26L124 22Z" fill="#5EEAD4" />
                    <circle cx="20" cy="22" r="2" fill="#5EEAD4" />
                    <circle cx="108" cy="88" r="1.5" fill="#A7F3D0" />
                    <defs>
                      <linearGradient id="folderGrad" x1="10" y1="38" x2="130" y2="98" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#175965" />
                        <stop offset="1" stopColor="#0F3F49" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>

              {/* Banner Center Content */}
              <div className="banner-center-text">
                <span className="banner-tag">TRUSTVAULT</span>
                <h2 className="banner-title">Secure &bull; Manage &bull; Share</h2>
                <p className="banner-desc">
                  Keep your important documents protected with role-based access,
                  encryption and complete audit trails.
                </p>
              </div>

              {/* Banner Right Script Art */}
              <div className="banner-right-script">
                <span className="script-line-1">Your data.</span>
                <span className="script-line-2">Your control.</span>
              </div>
            </section>

            {/* Stats Cards Row (4 cards) */}
            <section className="stats-row">
              {/* Card 1: Total Documents */}
              <div
                className="stat-card"
                onClick={() => setActiveTab('My Documents')}
                role="button"
                tabIndex={0}
              >
                <div className="stat-card-top">
                  <div className="stat-icon-box green-icon-box">
                    <FolderIcon />
                  </div>
                </div>
                <div className="stat-card-body">
                  <span className="stat-label">Total Documents</span>
                  <div className="stat-value">{loadingDocs ? '…' : documents.length}</div>
                  <span className="stat-subtext">Documents stored in your vault</span>
                </div>
                <button
                  type="button"
                  className="stat-arrow-btn"
                  aria-label="View Documents"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveTab('My Documents')
                  }}
                >
                  <ArrowRightIcon />
                </button>
              </div>

              {/* Card 2: Shared With Me */}
              <div
                className="stat-card"
                onClick={() => setActiveTab('Shared With Me')}
                role="button"
                tabIndex={0}
              >
                <div className="stat-card-top">
                  <div className="stat-icon-box blue-icon-box">
                    <UsersIcon />
                  </div>
                </div>
                <div className="stat-card-body">
                  <span className="stat-label">Shared With Me</span>
                  <div className="stat-value">{loadingShared ? '…' : sharedDocuments.length}</div>
                  <span className="stat-subtext">Documents shared with your account</span>
                </div>
                <button
                  type="button"
                  className="stat-arrow-btn"
                  aria-label="View Shared Documents"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveTab('Shared With Me')
                  }}
                >
                  <ArrowRightIcon />
                </button>
              </div>

              {/* Card 3: Recent Activity */}
              <div
                className="stat-card"
                onClick={() => setActiveTab('Activity Log')}
                role="button"
                tabIndex={0}
              >
                <div className="stat-card-top">
                  <div className="stat-icon-box amber-icon-box">
                    <ClockIcon />
                  </div>
                </div>
                <div className="stat-card-body">
                  <span className="stat-label">Recent Activity</span>
                  <div className="stat-value">
                    {loadingAudit ? '…' : isAdmin ? auditLogs.length : '—'}
                  </div>
                  <span className="stat-subtext">
                    {isAdmin ? 'Audit events recorded' : 'Administrator access required'}
                  </span>
                </div>
                <button
                  type="button"
                  className="stat-arrow-btn"
                  aria-label="View Activity Log"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveTab('Activity Log')
                  }}
                >
                  <ArrowRightIcon />
                </button>
              </div>

              {/* Card 4: Security Status */}
              <div
                className="stat-card"
                onClick={() => setShowSecurityModal(true)}
                role="button"
                tabIndex={0}
              >
                <div className="stat-card-top">
                  <div className="stat-icon-box teal-icon-box">
                    <ShieldCheckIcon />
                  </div>
                </div>
                <div className="stat-card-body">
                  <span className="stat-label">Security Status</span>
                  <div className="stat-value active-status-text">Active</div>
                  <span className="stat-subtext">All systems secure</span>
                </div>
                <button
                  type="button"
                  className="stat-arrow-btn"
                  aria-label="View Security Status"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowSecurityModal(true)
                  }}
                >
                  <ArrowRightIcon />
                </button>
              </div>
            </section>

            {/* Two-Column Main Content Section */}
            <div className="main-two-col-grid">
              {/* Left Column: My Documents Table Card */}
              <section className="documents-table-card">
                <div className="table-card-header">
                  <div className="table-header-left">
                    <div className="table-header-title-wrap">
                      <span className="table-header-folder-icon">
                        <FolderIcon />
                      </span>
                      <h3>My Documents</h3>
                    </div>
                    <p className="table-header-sub">
                      Manage your uploaded documents and control their access.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="upload-doc-primary-btn"
                    onClick={() => {
                      setUploadError('')
                      setShowUploadModal(true)
                    }}
                  >
                    <PlusIcon />
                    <span>Upload Document</span>
                  </button>
                </div>

                {/* Active Search Banner */}
                {searchQuery && (
                  <div className="search-query-banner">
                    <span>
                      Found <strong>{filteredDocuments.length}</strong> {filteredDocuments.length === 1 ? 'document' : 'documents'} matching &ldquo;<strong>{searchQuery}</strong>&rdquo;
                    </span>
                    <button
                      type="button"
                      className="banner-clear-btn"
                      onClick={() => setSearchQuery('')}
                    >
                      Clear Search
                    </button>
                  </div>
                )}

                {/* Table Content */}
                <div className="documents-table-wrap">
                  <table className="documents-table">
                    <thead>
                      <tr>
                        <th className="th-name">Name</th>
                        <th className="th-size">Size</th>
                        <th className="th-uploaded">Uploaded</th>
                        <th className="th-actions">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingDocs ? (
                        <tr>
                          <td colSpan="4" className="empty-table-cell">
                            <div className="empty-table-state">
                              <span className="loading-spinner">◌</span>
                              <p>Loading your documents...</p>
                            </div>
                          </td>
                        </tr>
                      ) : docsError ? (
                        <tr>
                          <td colSpan="4" className="empty-table-cell">
                            <div className="empty-table-state">
                              <span className="empty-icon">⚠️</span>
                              <p>{docsError}</p>
                              <button
                                type="button"
                                className="clear-search-link"
                                onClick={loadDocuments}
                              >
                                Try again
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : filteredDocuments.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="empty-table-cell">
                            <div className="empty-table-state">
                              <span className="empty-icon">📂</span>
                              <p>
                                {searchQuery
                                  ? `No documents matching "${searchQuery}".`
                                  : 'No documents uploaded yet.'}
                              </p>
                              {searchQuery ? (
                                <button
                                  type="button"
                                  className="clear-search-link"
                                  onClick={() => setSearchQuery('')}
                                >
                                  Clear search
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="clear-search-link"
                                  onClick={() => setShowUploadModal(true)}
                                >
                                  + Upload your first document
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredDocuments.map((doc) => {
                          const docId = doc._id || doc.id
                          const isMenuOpen = activeMenuDocId === docId
                          const docName = doc.originalName || doc.title || 'Untitled Document'
                          const fileType = getFileType(docName)

                          return (
                            <tr key={docId} className="document-row-item">
                              {/* Name with File Type Badge */}
                              <td className="td-name">
                                <div className="file-name-cell">
                                  <span className={`file-badge badge-${fileType.toLowerCase()}`}>
                                    {fileType}
                                  </span>
                                  <span className="file-name-text" title={docName}>
                                    {docName}
                                  </span>
                                </div>
                              </td>

                              {/* Size */}
                              <td className="td-size">{formatFileSize(doc.size)}</td>

                              {/* Uploaded */}
                              <td className="td-uploaded">
                                {formatRelativeTime(doc.createdAt)}
                              </td>

                              {/* Actions */}
                              <td className="td-actions">
                                <div className="row-action-btns">
                                  {/* Download button */}
                                  <button
                                    type="button"
                                    className="action-icon-btn"
                                    title="Download Document"
                                    onClick={() => handleDownload(doc)}
                                  >
                                    <DownloadIcon />
                                  </button>

                                  {/* Share button */}
                                  <button
                                    type="button"
                                    className="action-icon-btn"
                                    title="Share Document"
                                    onClick={() => openShareForDoc(doc)}
                                  >
                                    <ShareIcon />
                                  </button>

                                  {/* 3-dots Menu button */}
                                  <div
                                    className="menu-container"
                                    ref={isMenuOpen ? menuRef : null}
                                  >
                                    <button
                                      type="button"
                                      className={`action-icon-btn ${isMenuOpen ? 'active' : ''}`}
                                      title="More Options"
                                      onClick={() =>
                                        setActiveMenuDocId(isMenuOpen ? null : docId)
                                      }
                                    >
                                      <ThreeDotsIcon />
                                    </button>

                                    {/* Action Popover Menu */}
                                    {isMenuOpen && (
                                      <div className="action-popover-menu">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleDownload(doc)
                                            setActiveMenuDocId(null)
                                          }}
                                        >
                                          <DownloadIcon />
                                          Download
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => openShareForDoc(doc)}
                                        >
                                          <ShareIcon />
                                          Share Document
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => openPermissionsForDoc(doc)}
                                        >
                                          <ShieldLockIcon />
                                          Manage Permissions
                                        </button>
                                        <div className="menu-separator" />
                                        <button
                                          type="button"
                                          className="delete-menu-item"
                                          onClick={() => handleDeleteDocument(doc)}
                                        >
                                          <TrashIcon />
                                          Delete Document
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer / Pagination */}
                <div className="table-card-footer">
                  <span className="showing-entries-text">
                    Showing {filteredDocuments.length} of {documents.length} documents
                  </span>
                  <div className="pagination-ctrls">
                    <button type="button" className="page-nav-btn" disabled>
                      &lt;
                    </button>
                    <button type="button" className="page-num-btn active">
                      1
                    </button>
                    <button type="button" className="page-nav-btn" disabled>
                      &gt;
                    </button>
                  </div>
                </div>
              </section>

              {/* Right Column: Quick Actions & Recent Activity Widgets */}
              <div className="right-widgets-col">
                {/* Widget 1: Quick Actions */}
                <div className="quick-actions-card">
                  <div className="widget-header">
                    <span className="widget-header-icon lightning-icon">
                      <ZapIcon />
                    </span>
                    <h3>Quick Actions</h3>
                  </div>

                  <div className="quick-actions-list">
                    {/* Action 1: Upload Document */}
                    <div
                      className="quick-action-item"
                      onClick={() => setShowUploadModal(true)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="action-circle-icon green-circle">
                        <UploadCloudIcon />
                      </div>
                      <div className="action-info">
                        <strong>Upload Document</strong>
                        <p>Add a new file to your vault</p>
                      </div>
                      <ChevronRightIcon />
                    </div>

                    {/* Action 2: Share Document */}
                    <div
                      className="quick-action-item"
                      onClick={() => {
                        if (documents.length > 0) {
                          setShareDocId(documents[0]._id || documents[0].id)
                        }
                        setShowShareModal(true)
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="action-circle-icon blue-circle">
                        <UsersIcon />
                      </div>
                      <div className="action-info">
                        <strong>Share Document</strong>
                        <p>Grant access to others</p>
                      </div>
                      <ChevronRightIcon />
                    </div>

                    {/* Action 3: Manage Permissions */}
                    <div
                      className="quick-action-item"
                      onClick={() => {
                        if (documents.length > 0) {
                          setPermDoc(documents[0])
                        }
                        setShowPermissionsModal(true)
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="action-circle-icon amber-circle">
                        <ShieldLockIcon />
                      </div>
                      <div className="action-info">
                        <strong>Manage Permissions</strong>
                        <p>Control who can access</p>
                      </div>
                      <ChevronRightIcon />
                    </div>

                    {/* Action 4: View Activity Log */}
                    <div
                      className="quick-action-item"
                      onClick={() => setActiveTab('Activity Log')}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="action-circle-icon teal-circle">
                        <ClockIcon />
                      </div>
                      <div className="action-info">
                        <strong>View Activity Log</strong>
                        <p>Track all document events</p>
                      </div>
                      <ChevronRightIcon />
                    </div>
                  </div>
                </div>

                {/* Widget 2: Recent Activity (Real backend audit logs) */}
                <div className="recent-activity-card">
                  <div className="widget-header space-between">
                    <div className="header-left-title">
                      <span className="widget-header-icon teal-pulse-icon">
                        <ActivityPulseIcon />
                      </span>
                      <h3>Recent Activity</h3>
                    </div>
                    <button
                      type="button"
                      className="view-all-link-btn"
                      onClick={() => setActiveTab('Activity Log')}
                    >
                      View all &rarr;
                    </button>
                  </div>

                  <div className="recent-activities-list">
                    {loadingAudit ? (
                      <p className="no-viewers-msg">Loading audit logs...</p>
                    ) : auditError ? (
                      <p className="no-viewers-msg">{auditError}</p>
                    ) : auditLogs.length === 0 ? (
                      <p className="no-viewers-msg">No audit activity recorded yet.</p>
                    ) : (
                      auditLogs.slice(0, 4).map((log) => {
                        const act = log.action ? log.action.toUpperCase() : 'EVENT'
                        let iconColor = 'green'
                        let title = 'Document uploaded'

                        if (act === 'SHARE') {
                          iconColor = 'blue'
                          title = 'Document shared'
                        } else if (act === 'DOWNLOAD') {
                          iconColor = 'orange'
                          title = 'Document downloaded'
                        } else if (act === 'REVOKE') {
                          iconColor = 'red'
                          title = 'Access revoked'
                        } else if (act === 'DELETE') {
                          iconColor = 'red'
                          title = 'Document deleted'
                        }

                        const docName =
                          log.document && typeof log.document === 'object'
                            ? log.document.originalName || log.document.title
                            : ''

                        const subtitle = log.details || docName || 'Document activity'

                        return (
                          <div key={log._id} className="activity-item-row">
                            <div className={`activity-circle-icon ${iconColor}-circle`}>
                              {act === 'UPLOAD' && <ArrowUpIcon />}
                              {act === 'SHARE' && <UsersIcon />}
                              {act === 'DOWNLOAD' && <ArrowDownIcon />}
                              {(act === 'REVOKE' || act === 'DELETE') && <BanIcon />}
                            </div>
                            <div className="activity-item-details">
                              <strong>{title}</strong>
                              <p title={subtitle}>{subtitle}</p>
                            </div>
                            <span className="activity-time-stamp">
                              {formatRelativeTime(log.createdAt)}
                            </span>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        
        {/* ================= TAB: CATEGORIES ================= */}
        {activeTab === 'Categories' && (
          <div className="tab-standalone-view">
            <div className="standalone-view-header">
              <div>
                <h2>Document Categories</h2>
                <p>Choose a category to explore your documents.</p>
              </div>
              <button
                type="button"
                className="upload-doc-primary-btn"
                onClick={() => setShowUploadModal(true)}
              >
                <PlusIcon />
                <span>Upload Document</span>
              </button>
            </div>

            <div className="categories-grid-container">
              {DOCUMENT_CATEGORIES.map((cat) => {
                const count = documents.filter(
                  (d) => (d.category || 'General').toLowerCase() === cat.name.toLowerCase()
                ).length

                return (
                  <div
                    key={cat.name}
                    className="category-card"
                    onClick={() => {
                      setSelectedCategory(cat.name)
                      setActiveTab('My Documents')
                    }}
                  >
                    <div className="category-top-accent" style={{ background: cat.color }} />
                    <div className="category-header-wrap">
                      <div className="category-icon-box" style={{ background: `${cat.color}18` }}>
                        <span className="category-icon-text">{cat.icon}</span>
                      </div>
                    </div>
                    <div className="category-card-body">
                      <h3 className="category-title">{cat.name}</h3>
                      <span className="category-count-badge">
                        {count} document{count !== 1 ? 's' : ''}
                      </span>
                      <p className="category-description">{cat.description}</p>
                    </div>
                    <div className="category-card-footer">
                      <span className="view-docs-btn">
                        View Documents &rarr;
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ================= TAB: MY DOCUMENTS (FULL VIEW) ================= */}
        {activeTab === 'My Documents' && (
          <div className="tab-standalone-view">
            <div className="standalone-view-header">
              <div>
                <h2>My Documents</h2>
                <p>Manage all files stored in your encrypted vault.</p>
              </div>
              <div className="standalone-header-actions">
                <form className="table-search-form" onSubmit={handleSearchSubmit}>
                  <div className="table-search-box">
                    <SearchIcon />
                    <input
                      type="text"
                      placeholder="Search documents..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      aria-label="Search documents"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        className="search-clear-btn"
                        onClick={() => setSearchQuery('')}
                        title="Clear"
                      >
                        ✕
                      </button>
                    )}
                    <button type="submit" className="search-action-btn">
                      Search
                    </button>
                  </div>
                </form>
                <button
                  type="button"
                  className="upload-doc-primary-btn"
                  onClick={() => setShowUploadModal(true)}
                >
                  <PlusIcon />
                  <span>Upload Document</span>
                </button>
              </div>
            </div>

            <div className="documents-table-card">
              {/* Active Search Banner */}
              {searchQuery && (
                <div className="search-query-banner">
                  <span>
                    Found <strong>{filteredDocuments.length}</strong> {filteredDocuments.length === 1 ? 'document' : 'documents'} matching &ldquo;<strong>{searchQuery}</strong>&rdquo;
                  </span>
                  <button
                    type="button"
                    className="banner-clear-btn"
                    onClick={() => setSearchQuery('')}
                  >
                    Clear Search
                  </button>
                </div>
              )}
              <div className="documents-table-wrap">
                <table className="documents-table">
                  <thead>
                    <tr>
                      <th className="th-name">Name</th>
                      <th className="th-size">Size</th>
                      <th className="th-uploaded">Uploaded</th>
                      <th className="th-perms">Access Permissions</th>
                      <th className="th-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocuments.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="empty-table-cell">
                          <div className="empty-table-state">
                            <span className="empty-icon">📂</span>
                            <p>No documents found.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredDocuments.map((doc) => {
                        const docId = doc._id || doc.id
                        const docName = doc.originalName || doc.title || 'Untitled'
                        const viewersCount = doc.allowedViewers?.length || 0

                        return (
                          <tr key={docId} className="document-row-item">
                            <td>
                              <div className="file-name-cell">
                                <span className={`file-badge badge-${getFileType(docName).toLowerCase()}`}>
                                  {getFileType(docName)}
                                </span>
                                <span className="file-name-text" title={docName}>{docName}</span>
                              </div>
                            </td>
                            <td className="td-size">{formatFileSize(doc.size)}</td>
                            <td className="td-uploaded">{formatRelativeTime(doc.createdAt)}</td>
                          <td>
                            {viewersCount > 0 ? (
                              <span className="shared-badge">
                                Shared with {viewersCount} user{viewersCount > 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span className="private-badge">Private (Only you)</span>
                            )}
                          </td>
                          <td>
                            <div className="row-action-btns">
                              <button
                                type="button"
                                className="action-icon-btn"
                                title="Download"
                                onClick={() => handleDownload(doc)}
                              >
                                <DownloadIcon />
                              </button>
                              <button
                                type="button"
                                className="action-icon-btn"
                                title="Share"
                                onClick={() => openShareForDoc(doc)}
                              >
                                <ShareIcon />
                              </button>
                              <button
                                type="button"
                                className="action-icon-btn"
                                title="Permissions"
                                onClick={() => openPermissionsForDoc(doc)}
                              >
                                <ShieldLockIcon />
                              </button>
                              <button
                                type="button"
                                className="action-icon-btn delete-btn"
                                title="Delete"
                                onClick={() => handleDeleteDocument(doc)}
                              >
                                <TrashIcon />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

        {/* ================= TAB: SHARED WITH ME ================= */}
        {activeTab === 'Shared With Me' && (
          <div className="tab-standalone-view">
            <div className="standalone-view-header">
              <div>
                <h2>Shared With Me</h2>
                <p>Documents that other accounts have granted you access to.</p>
              </div>
            </div>

            {loadingShared ? (
              <div className="standalone-empty-card">
                <p>Loading shared documents...</p>
              </div>
            ) : sharedDocuments.length === 0 ? (
              <div className="standalone-empty-card">
                <div className="empty-card-icon">⇄</div>
                <h3>No shared documents yet</h3>
                <p>When another user shares documents with {userEmail}, they will appear here with instant download access.</p>
              </div>
            ) : (
              <div className="documents-table-card">
                <div className="documents-table-wrap">
                  <table className="documents-table">
                    <thead>
                      <tr>
                        <th className="th-name">Document</th>
                        <th style={{ width: '25%' }}>Owner</th>
                        <th className="th-size">Size</th>
                        <th className="th-actions">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sharedDocuments.map((doc) => {
                        const docName = doc.originalName || doc.title || 'Untitled'
                        return (
                          <tr key={doc._id} className="document-row-item">
                            <td>
                              <div className="file-name-cell">
                                <span className={`file-badge badge-${getFileType(docName).toLowerCase()}`}>
                                  {getFileType(docName)}
                                </span>
                                <span className="file-name-text" title={docName}>{docName}</span>
                              </div>
                            </td>
                            <td>{doc.owner?.name || doc.owner?.email || 'External User'}</td>
                            <td className="td-size">{formatFileSize(doc.size)}</td>
                            <td>
                              <div className="row-action-btns">
                                <button
                                  type="button"
                                  className="action-icon-btn"
                                  title="Download"
                                  onClick={() => handleDownload(doc)}
                                >
                                  <DownloadIcon />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB: ACTIVITY LOG ================= */}
        {activeTab === 'Activity Log' && (
          <div className="tab-standalone-view">
            <div className="standalone-view-header">
              <div>
                <h2>Activity &amp; Audit Log</h2>
                <p>Immutable audit trail of all vault operations, access grants, and downloads.</p>
              </div>
              <button
                type="button"
                className="refresh-secondary-btn"
                onClick={loadAuditLogs}
                disabled={loadingAudit}
              >
                {loadingAudit ? 'Loading…' : '↻ Refresh Log'}
              </button>
            </div>

            {loadingAudit ? (
              <div className="standalone-empty-card">
                <p>Loading recorded audit events...</p>
              </div>
            ) : auditError ? (
              <div className="standalone-empty-card">
                <div className="empty-card-icon">🔒</div>
                <h3>{auditError}</h3>
                <p>Only accounts with role "admin" can inspect full system audit logs.</p>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="standalone-empty-card">
                <div className="empty-card-icon">◷</div>
                <h3>No activity recorded yet</h3>
                <p>Audit events will appear here when files are uploaded, downloaded, or shared.</p>
              </div>
            ) : (
              <div className="audit-log-full-card">
                <div className="audit-list">
                  {auditLogs.map((log) => {
                    const act = log.action ? log.action.toUpperCase() : 'EVENT'
                    let iconColor = 'green'
                    if (act === 'SHARE') iconColor = 'blue'
                    if (act === 'DOWNLOAD') iconColor = 'orange'
                    if (act === 'REVOKE' || act === 'DELETE') iconColor = 'red'

                    const docName =
                      log.document && typeof log.document === 'object'
                        ? log.document.originalName || log.document.title
                        : ''

                    const actor =
                      log.user && typeof log.user === 'object'
                        ? log.user.name || log.user.email
                        : 'User'

                    return (
                      <div key={log._id} className="audit-full-row">
                        <div className={`activity-circle-icon ${iconColor}-circle`}>
                          {act === 'UPLOAD' && <ArrowUpIcon />}
                          {act === 'SHARE' && <UsersIcon />}
                          {act === 'DOWNLOAD' && <ArrowDownIcon />}
                          {(act === 'REVOKE' || act === 'DELETE') && <BanIcon />}
                        </div>
                        <div className="audit-full-details">
                          <div className="audit-title-line">
                            <strong>{act}</strong>
                            <span className={`audit-tag-pill tag-${iconColor}`}>
                              {act}
                            </span>
                          </div>
                          <p>{log.details || docName}</p>
                          <small style={{ color: '#94a3b8', fontSize: '11px' }}>
                            By {actor} {docName ? `• Document: ${docName}` : ''}
                          </small>
                        </div>
                        <div className="audit-timestamp">
                          {formatRelativeTime(log.createdAt)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB: SETTINGS ================= */}
        {activeTab === 'Settings' && (
          <div className="tab-standalone-view">
            <div className="standalone-view-header">
              <div>
                <h2>Vault &amp; Account Settings</h2>
                <p>Configure personal credentials, security keys, and account preferences.</p>
              </div>
            </div>

            <div className="settings-grid">
              {/* Account profile card */}
              <div className="settings-card">
                <h3>Account Information</h3>
                <div className="settings-field">
                  <label>Full Name</label>
                  <input type="text" value={displayName} disabled />
                </div>
                <div className="settings-field">
                  <label>Email Address</label>
                  <input type="email" value={userEmail} disabled />
                </div>
                <div className="settings-field">
                  <label>Assigned Role</label>
                  <div className="role-chip-large">{userRole}</div>
                </div>
              </div>

              {/* Security parameters card */}
              <div className="settings-card">
                <h3>Vault Security Status</h3>
                <div className="security-metric-row">
                  <div>
                    <strong>Data Encryption</strong>
                    <p>AES-256-GCM hardware accelerated</p>
                  </div>
                  <span className="badge-active">ACTIVE</span>
                </div>
                <div className="security-metric-row">
                  <div>
                    <strong>Session Guard</strong>
                    <p>Tokenized with JWT authentication</p>
                  </div>
                  <span className="badge-active">SECURED</span>
                </div>
                <div className="security-metric-row">
                  <div>
                    <strong>Tamper-Proof Audit</strong>
                    <p>Every event recorded with strict immutability</p>
                  </div>
                  <span className="badge-active">ACTIVE</span>
                </div>
              </div>

              {/* Change Password Card */}
              <div className="settings-card full-width-card">
                <h3>Update Security Password</h3>
                {settingsMessage && <p className="settings-alert">{settingsMessage}</p>}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (newPassword.length < 8) {
                      setSettingsMessage('New password must be at least 8 characters.')
                      return
                    }

                    try {
                      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: userEmail, password: newPassword }),
                      })
                      const data = await res.json()
                      if (!res.ok) throw new Error(data.message || 'Failed to update password')

                      setSettingsMessage('Password updated successfully!')
                      setCurrentPassword('')
                      setNewPassword('')
                      setTimeout(() => setSettingsMessage(''), 3000)
                    } catch (err) {
                      setSettingsMessage(err.message || 'Password update failed')
                    }
                  }}
                  className="password-form"
                >
                  <div className="password-fields-row">
                    <div className="settings-field">
                      <label>Current Password</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="settings-field">
                      <label>New Password</label>
                      <input
                        type="password"
                        placeholder="At least 8 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <button type="submit" className="save-settings-btn">
                    Update Password
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ================= MODAL: UPLOAD DOCUMENT ================= */}
      {showUploadModal && (
        <div className="modal-backdrop" onClick={closeUploadModal}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <span className="modal-icon-badge green-badge">
                  <UploadCloudIcon />
                </span>
                <div>
                  <h3>Upload Document</h3>
                  <p>Encrypted before storage in your private vault.</p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={closeUploadModal}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="modal-form">
              {uploadError && <div className="modal-error-alert">{uploadError}</div>}

              <div className="form-group">
                <label htmlFor="modal-doc-title">Document Title *</label>
                <input
                  id="modal-doc-title"
                  type="text"
                  placeholder="e.g. quarterly-review.pdf"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  maxLength={150}
                />
              </div>

              <div className="form-group">
                <label htmlFor="modal-doc-desc">Description (Optional)</label>
                <textarea
                  id="modal-doc-desc"
                  rows="2"
                  placeholder="Short description of file contents..."
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  maxLength={500}
                />
              </div>

              <div className="form-group">
                <label htmlFor="modal-doc-category">Document Category</label>
                <select
                  id="modal-doc-category"
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="modal-select-field"
                >
                  <option value="General">General / Other</option>
                  <option value="Finance">💰 Finance (Invoices, receipts)</option>
                  <option value="HR">👥 HR (Resumes, employee records)</option>
                  <option value="Legal">⚖️ Legal (Contracts, NDA)</option>
                  <option value="IT">💻 IT (Specs, credentials, architecture)</option>
                  <option value="Education">🎓 Education (Certificates, studies)</option>
                  <option value="Personal">👤 Personal (ID proofs, medical)</option>
                </select>
              </div>

              {/* File Dropzone */}
              <div className="form-group">
                <label>Choose File *</label>
                <div
                  className={`file-dropzone ${uploadFile ? 'has-file' : ''}`}
                  onClick={() => document.getElementById('modal-file-input').click()}
                >
                  <input
                    id="modal-file-input"
                    type="file"
                    style={{ display: 'none' }}
                    accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setUploadFile(file)
                        if (!uploadTitle) setUploadTitle(file.name)
                        setUploadError('')
                      }
                    }}
                  />
                  <div className="dropzone-content">
                    <span className="dropzone-icon">☁️</span>
                    {uploadFile ? (
                      <div>
                        <strong>{uploadFile.name}</strong>
                        <p>{formatFileSize(uploadFile.size)}</p>
                      </div>
                    ) : (
                      <div>
                        <strong>Click or drag file here</strong>
                        <p>Supports PDF, DOCX, PNG, JPG (up to 5 MB)</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-actions-bar">
                <button
                  type="button"
                  className="modal-secondary-btn"
                  onClick={closeUploadModal}
                  disabled={uploadLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-primary-btn"
                  disabled={uploadLoading}
                >
                  {uploadLoading ? 'Uploading securely...' : 'Upload Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: SHARE DOCUMENT ================= */}
      {showShareModal && (
        <div className="modal-backdrop" onClick={() => setShowShareModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <span className="modal-icon-badge blue-badge">
                  <ShareIcon />
                </span>
                <div>
                  <h3>Share Document</h3>
                  <p>Grant access to a registered TrustVault user.</p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowShareModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleShareSubmit} className="modal-form">
              {shareError && <div className="modal-error-alert">{shareError}</div>}
              {shareSuccess && <div className="modal-success-alert">{shareSuccess}</div>}

              <div className="form-group">
                <label>Select Document *</label>
                <select
                  value={shareDocId}
                  onChange={(e) => setShareDocId(e.target.value)}
                  required
                >
                  <option value="">-- Choose a document --</option>
                  {documents.map((d) => (
                    <option key={d._id || d.id} value={d._id || d.id}>
                      {d.originalName || d.title} ({formatFileSize(d.size)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="share-email-input">User Email Address *</label>
                <input
                  id="share-email-input"
                  type="email"
                  placeholder="e.g. colleague@example.com"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  required
                />
              </div>

              <div className="modal-actions-bar">
                <button
                  type="button"
                  className="modal-secondary-btn"
                  onClick={() => setShowShareModal(false)}
                  disabled={shareLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-primary-btn"
                  disabled={shareLoading}
                >
                  {shareLoading ? 'Granting Access...' : 'Share Access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: MANAGE PERMISSIONS ================= */}
      {showPermissionsModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowPermissionsModal(false)}
        >
          <div className="modal-container large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <span className="modal-icon-badge amber-badge">
                  <ShieldLockIcon />
                </span>
                <div>
                  <h3>Manage Document Permissions</h3>
                  <p>Audit and revoke access for external viewers.</p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowPermissionsModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="permissions-modal-body">
              <div className="permissions-doc-list">
                {documents.length === 0 ? (
                  <p className="no-viewers-msg">No documents available.</p>
                ) : (
                  documents.map((doc) => {
                    const docId = doc._id || doc.id
                    const viewers = doc.allowedViewers || []
                    const docName = doc.originalName || doc.title

                    return (
                      <div key={docId} className="permission-doc-card">
                        <div className="perm-card-top">
                          <div className="file-name-cell">
                            <span className={`file-badge badge-${getFileType(docName).toLowerCase()}`}>
                              {getFileType(docName)}
                            </span>
                            <strong>{docName}</strong>
                          </div>
                          <span className="doc-size-badge">{formatFileSize(doc.size)}</span>
                        </div>

                        <div className="perm-viewers-list">
                          {viewers.length === 0 ? (
                            <p className="no-viewers-msg">
                              No external viewers. This document is private to you.
                            </p>
                          ) : (
                            viewers.map((viewer) => {
                              const vEmail = typeof viewer === 'object' ? viewer.email || viewer.name : viewer
                              return (
                                <div key={vEmail} className="viewer-row">
                                  <div className="viewer-info">
                                    <span className="viewer-avatar">
                                      {(vEmail?.[0] || 'U').toUpperCase()}
                                    </span>
                                    <div>
                                      <strong>{vEmail}</strong>
                                      <small>Role: Viewer (Read &amp; Download)</small>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    className="revoke-access-btn"
                                    disabled={revokingEmail === vEmail}
                                    onClick={() => handleRevokePermission(docId, vEmail)}
                                  >
                                    {revokingEmail === vEmail ? 'Revoking…' : 'Revoke Access'}
                                  </button>
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="modal-actions-bar">
                <button
                  type="button"
                  className="modal-primary-btn"
                  onClick={() => setShowPermissionsModal(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: SECURITY STATUS ================= */}
      {showSecurityModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowSecurityModal(false)}
        >
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <span className="modal-icon-badge teal-badge">
                  <ShieldCheckIcon />
                </span>
                <div>
                  <h3>TrustVault Security Verification</h3>
                  <p>Real-time status of your vault security perimeter.</p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowSecurityModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="security-overview-body">
              <div className="sec-banner-status">
                <span className="status-indicator-dot" />
                <strong>All Systems Protected &amp; Verified</strong>
              </div>

              <div className="sec-feature-item">
                <div className="sec-icon">🔒</div>
                <div>
                  <strong>End-to-End Encryption</strong>
                  <p>Files encrypted using AES-256 before write to storage.</p>
                </div>
              </div>

              <div className="sec-feature-item">
                <div className="sec-icon">🛡️</div>
                <div>
                  <strong>Role-Based Access Control</strong>
                  <p>Strict access verification prevents unauthorized downloads.</p>
                </div>
              </div>

              <div className="sec-feature-item">
                <div className="sec-icon">📜</div>
                <div>
                  <strong>Tamper-Proof Audit Trails</strong>
                  <p>Every upload, share, download, and revoke is permanently logged.</p>
                </div>
              </div>

              <div className="modal-actions-bar">
                <button
                  type="button"
                  className="modal-primary-btn"
                  onClick={() => setShowSecurityModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ================= INLINE SVG HELPER COMPONENTS ================= */

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
    </svg>
  )
}

function FileTextIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function SignOutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function ShieldLockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <rect x="9" y="10" width="6" height="5" rx="1" fill="currentColor" />
    </svg>
  )
}

function ShieldCheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  )
}

function ShieldCheckBadgeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#0D9488" />
      <polyline points="9 12 11 14 15 10" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}

function ThreeDotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  )
}

function ZapIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

function UploadCloudIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
      <polyline points="16 16 12 12 8 16" />
    </svg>
  )
}

function ActivityPulseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function ArrowUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  )
}

function ArrowDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  )
}

function BanIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}
