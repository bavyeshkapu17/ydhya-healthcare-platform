
import { useEffect, useState } from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'

import {
  Activity,
  LayoutDashboard,
  Stethoscope,
  FileText,
  Image,
  CalendarDays,
  Pill,
  CreditCard,
  Settings,
  Search,
  HeartPulse,
  ShieldCheck,
  ArrowUpRight,
  Plus,
  Menu,
  X,
  MessageCircle,
  Clock,
  ChevronRight,
  LogOut,
  ClipboardList,
  Sparkles,
  Check,
  UserRound,
} from 'lucide-react'

import { supabase } from './lib/supabase'
import HomePage from './Homepage'
import AuthPage from './AuthPage'
import AdminDashboard from './AdminDashboard'
import PatientProfile from './PatientProfile'
import PatientHealthRecords from './PatientHealthRecords'
import DoctorDirectory from './DoctorDirectory'
import DoctorDashboard from './DoctorDashboard'
import Appointments from './Appointments'
import ConsultationHistory from './ConsultationHistory'
import Notifications from './Notifications'
import './App.css'

const navigation = [
  { title: 'Overview', icon: LayoutDashboard, section: 'Main' },
  { title: 'AI Health Assistant', icon: MessageCircle, section: 'Main' },
  { title: 'Symptom Assessment', icon: Activity, section: 'Main' },
  { title: 'Medical Reports', icon: FileText, section: 'Main' },
  { title: 'Image Assessment', icon: Image, section: 'Main' },

  { title: 'Doctors', icon: Stethoscope, section: 'Care' },
  { title: 'Appointments', icon: CalendarDays, section: 'Care' },
  { title: 'My Consultations', icon: ClipboardList, section: 'Care' },
  { title: 'Patient Profile', icon: UserRound, section: 'Care' },
  { title: 'Health Records', icon: ClipboardList, section: 'Care' },
  { title: 'Medications', icon: Pill, section: 'Care' },

  { title: 'Membership & Payments', icon: CreditCard, section: 'Account' },
  { title: 'Doctor Dashboard', icon: Stethoscope, section: 'Account' },
  { title: 'Admin Dashboard', icon: ShieldCheck, section: 'Account' },
  { title: 'Settings', icon: Settings, section: 'Account' },
]

const descriptions: Record<string, string> = {
  'AI Health Assistant':
    'Get general health information and guidance from the YDHYA assistant.',
  'Symptom Assessment':
    'Record your symptoms and receive an informational assessment.',
  'Medical Reports':
    'Upload and understand your medical reports and laboratory results.',
  'Image Assessment':
    'Submit an image for analysis of visible features.',
  Doctors:
    'Explore medical specialties and doctor profiles.',
  Appointments:
    'Manage your consultation requests and appointments.',
  'My Consultations':
    'View your online and in-person consultations, doctor notes and follow-ups.',
  'Health Records':
    'Your health information and assessment history.',
  'Patient Profile':
    'View and update your personal health profile.',
  Medications:
    'Manage medication schedules and reminders.',
  'Membership & Payments':
    'Explore your membership and payment history.',
  'Doctor Dashboard':
    'Manage your professional profile and verification status.',
  'Admin Dashboard':
    'Platform administration and management.',
  Settings:
    'Manage your profile, preferences and privacy.',
}

const plans = [
  {
    name: 'Basic',
    price: 7000,
    description: 'Essential healthcare membership',
    features: [
      'AI Health Assistant',
      'Basic Symptom Assessment',
      'Medical Report Analysis',
      'Digital Health Records',
      'Medication Reminders',
      'Health Timeline',
      'Doctor Directory Access',
      'Standard Notifications',
    ],
  },
  {
    name: 'Plus',
    price: 14000,
    description: 'Enhanced healthcare membership',
    popular: true,
    features: [
      'Everything in Basic',
      'Advanced Symptom Tracking',
      'Enhanced Medical Report Insights',
      'Image Assessment',
      'Health Trend Analytics',
      'Personal Health Dashboard',
      'Priority Appointment Requests',
      'Advanced Medication Tracking',
      'Downloadable Health Summaries',
    ],
  },
  {
    name: 'Premium',
    price: 24000,
    description: 'Premium healthcare membership',
    features: [
      'Everything in Plus',
      'Advanced Health Analytics',
      'Family Health Profiles',
      'Family Health Timeline',
      'Priority Support',
      'Personalized Health Reports',
      'Advanced Health Reminders',
      'Health Record Export',
      'Dedicated Membership Support',
    ],
  },
]

function App() {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [accessLoading, setAccessLoading] = useState(false)

  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [isDoctor, setIsDoctor] = useState(false)
  const [membershipActive, setMembershipActive] = useState(false)
  const [isFreeDemoPatient, setIsFreeDemoPatient] = useState(false)

  const [patientName, setPatientName] = useState('')
  const [active, setActive] = useState('Overview')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('Plus')
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    let mounted = true

    const loadAccess = async (currentUser: SupabaseUser) => {
      if (!mounted) return

      setAccessLoading(true)

      const metadataName =
        currentUser.user_metadata?.full_name ||
        currentUser.user_metadata?.name ||
        currentUser.user_metadata?.display_name ||
        ''

      if (mounted) {
        setPatientName(
          metadataName || currentUser.email?.split('@')[0] || 'Patient'
        )
      }

      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', currentUser.id)
          .maybeSingle()

        if (profileError) {
          console.error('Patient name loading failed:', profileError)
        }

        if (mounted && profile?.full_name?.trim()) {
          setPatientName(profile.full_name.trim())
        }

        const { data: adminResult, error: adminError } =
          await supabase.rpc('is_super_admin')

        if (adminError) throw adminError

        const admin = adminResult === true

        const { data: roleRows, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', currentUser.id)

        if (roleError) throw roleError

        const doctor =
          !admin && (roleRows || []).some(row => row.role === 'doctor')

        let hasMembership = false
        let freeDemoPatient = false

        if (!admin && !doctor) {
          const { data: demoResult, error: demoError } =
            await supabase.rpc('is_free_demo_patient')

          if (demoError) throw demoError

          freeDemoPatient = demoResult === true

          if (!freeDemoPatient) {
            const { data, error } = await supabase
              .from('memberships')
              .select('id')
              .eq('user_id', currentUser.id)
              .eq('status', 'active')
              .gt('expires_at', new Date().toISOString())
              .limit(1)
              .maybeSingle()

            if (error) throw error

            hasMembership = Boolean(data)
          }
        }

        if (mounted) {
          setIsSuperAdmin(admin)
          setIsDoctor(doctor)
          setMembershipActive(hasMembership)
          setIsFreeDemoPatient(freeDemoPatient)

          setActive(
            admin
              ? 'Admin Dashboard'
              : doctor
                ? 'Doctor Dashboard'
                : 'Patient Profile'
          )
        }
      } catch (error) {
        console.error('YDHYA access verification failed:', error)

        if (mounted) {
          setIsSuperAdmin(false)
          setIsDoctor(false)
          setMembershipActive(false)
          setIsFreeDemoPatient(false)
          setActive('Overview')
        }
      } finally {
        if (mounted) {
          setAccessLoading(false)
          setAuthLoading(false)
        }
      }
    }

    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        console.error('Session check failed:', error)
      }

      if (!mounted) return

      const currentUser = data.session?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        await loadAccess(currentUser)
      } else {
        setAuthLoading(false)
      }
    }

    void checkSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return

      const currentUser = session?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        void loadAccess(currentUser)
      } else {
        setPatientName('')
        setIsSuperAdmin(false)
        setIsDoctor(false)
        setMembershipActive(false)
        setIsFreeDemoPatient(false)
        setActive('Overview')
        setAccessLoading(false)
        setAuthLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Sign out failed:', error)
      alert('Unable to sign out. Please try again.')
    }
  }

  const selectPage = (page: string) => {
    if (page === 'Admin Dashboard' && !isSuperAdmin) return
    if (page === 'Doctor Dashboard' && !isDoctor) return

    if (
      (page === 'Appointments' || page === 'My Consultations') &&
      (isDoctor || isSuperAdmin)
    ) return

    setActive(page)
    setMobileOpen(false)
  }

  const displayName = isSuperAdmin
    ? "Bavyesh's Admin"
    : patientName || (isDoctor ? 'Doctor' : 'Patient')

  const avatarLetter = isSuperAdmin
    ? 'B'
    : (patientName.trim().charAt(0).toUpperCase() || 'P')

  if (authLoading) {
    return (
      <div className="membership-screen">
        <div className="membership-container">
          <div className="membership-brand">
            <HeartPulse size={30} />
            <h2>Bavyesh's YDHYA</h2>
          </div>
          <p>Loading your secure YDHYA workspace...</p>
        </div>
      </div>
    )
  }

  if (!user && !showAuth) {
    return (
      <HomePage
        onGetStarted={plan => {
          if (plan) setSelectedPlan(plan)
          setShowAuth(true)
        }}
      />
    )
  }

  if (!user && showAuth) {
    return (
      <AuthPage
        onBack={() => setShowAuth(false)}
        onSuccess={() => {}}
      />
    )
  }

  if (accessLoading) {
    return (
      <div className="membership-screen">
        <div className="membership-container">
          <HeartPulse size={30} />
          <h2>Verifying your YDHYA access...</h2>
        </div>
      </div>
    )
  }

  if (
    !isSuperAdmin &&
    !isDoctor &&
    !isFreeDemoPatient &&
    !membershipActive
  ) {
    const selected =
      plans.find(plan => plan.name === selectedPlan) ?? plans[1]

    return (
      <main className="membership-screen">
        <div className="membership-container">
          <div className="membership-brand">
            <div className="brand-icon">
              <HeartPulse size={27} />
            </div>
            <div>
              <h2>Bavyesh's YDHYA</h2>
              <span>YOUR HEALTH. ONE PLATFORM.</span>
            </div>
          </div>

          <div className="membership-heading">
            <span className="eyebrow">WELCOME TO YDHYA</span>
            <h1>Choose your membership.</h1>
            <p>
              Choose the annual membership that suits your healthcare
              needs. Each plan has its own set of benefits.
            </p>
          </div>

          <div className="membership-grid">
            {plans.map(plan => (
              <button
                type="button"
                key={plan.name}
                className={`membership-card ${
                  selectedPlan === plan.name ? 'selected' : ''
                }`}
                onClick={() => setSelectedPlan(plan.name)}
              >
                {'popular' in plan && plan.popular && (
                  <span className="popular-label">POPULAR PLAN</span>
                )}

                <span className="plan-name">{plan.name}</span>
                <strong className="plan-price">
                  ₹{plan.price.toLocaleString('en-IN')}
                </strong>
                <span className="plan-duration">per year</span>
                <p>{plan.description}</p>

                <div className="plan-includes">
                  <strong>Plan benefits:</strong>
                  {plan.features.map(feature => (
                    <span key={feature}>
                      <Check size={16} />
                      {feature}
                    </span>
                  ))}
                </div>

                <span className="plan-select">
                  {selectedPlan === plan.name ? '✓ Selected' : 'Select Plan'}
                </span>
              </button>
            ))}
          </div>

          <div className="membership-checkout">
            <div>
              <span>YOUR SELECTED PLAN</span>
              <h2>{selected.name} Membership</h2>
              <p>₹{selected.price.toLocaleString('en-IN')} / year</p>
            </div>

            <button
              className="primary-button"
              type="button"
              onClick={() => {
                alert(
                  'Payment integration is not connected yet. Membership cannot be activated until payment is securely verified.'
                )
              }}
            >
              Continue to Payment
              <ArrowUpRight size={18} />
            </button>
          </div>

          <button
            className="text-button"
            type="button"
            onClick={handleSignOut}
          >
            <LogOut size={15} />
            Sign out
          </button>

          <p className="membership-footer">
            Membership activation happens only after secure payment
            verification. Doctor consultations, tests and medicines
            may have separate charges unless explicitly included in
            your plan. YDHYA health information does not replace
            professional medical care.
          </p>
        </div>
      </main>
    )
  }

  return (
    <div className="app-shell">
      {mobileOpen && (
        <button
          className="mobile-overlay"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        />
      )}

      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-icon">
            <HeartPulse size={25} />
          </div>

          <div>
            <h2>YDHYA</h2>
            <span>BY BAVYESH</span>
          </div>

          <button
            className="mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
          >
            <X />
          </button>
        </div>

        <div className="sidebar-profile">
          <div className="avatar">{avatarLetter}</div>
          <div>
            <strong>{displayName}</strong>
            <span>
              {isSuperAdmin
                ? 'Super Admin'
                : isDoctor
                  ? 'Doctor workspace'
                  : 'Patient workspace'}
            </span>
          </div>
        </div>

        {['Main', 'Care', 'Account'].map(section => (
          <div className="nav-section" key={section}>
            <p className="nav-heading">{section}</p>

            {navigation
              .filter(item => item.section === section)
              .filter(item => {
                if (item.title === 'Admin Dashboard') return isSuperAdmin
                if (item.title === 'Doctor Dashboard') return isDoctor
                return true
              })
              .filter(item => {
                if (isDoctor) {
                  return (
                    item.title === 'Overview' ||
                    item.title === 'Doctor Dashboard' ||
                    item.title === 'Doctors' ||
                    item.title === 'Settings'
                  )
                }

                if (isSuperAdmin) {
                  return (
                    item.title === 'Overview' ||
                    item.title === 'Admin Dashboard' ||
                    item.title === 'Settings'
                  )
                }

                return true
              })
              .map(item => {
                const Icon = item.icon

                return (
                  <button
                    key={item.title}
                    className={`nav-item ${
                      active === item.title ? 'active' : ''
                    }`}
                    onClick={() => selectPage(item.title)}
                  >
                    <Icon size={18} />
                    <span>{item.title}</span>
                  </button>
                )
              })}
          </div>
        ))}

        <div className="sidebar-bottom">
          <div className="support-card">
            <Sparkles size={20} />
            <strong>Your health, simplified.</strong>
            <span>One platform for your health journey.</span>
          </div>

          <button
            className="nav-item"
            type="button"
            onClick={handleSignOut}
          >
            <LogOut size={18} />
            <span>Sign out</span>
          </button>

          <small>YDHYA © 2026 · Version 1.0</small>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu />
          </button>

          <div className="breadcrumb">
            Workspace
            <ChevronRight size={15} />
            <strong>{active}</strong>
          </div>

          <div className="top-actions">
            <button className="icon-button" aria-label="Search">
              <Search size={19} />
            </button>

            {user && <Notifications userId={user.id} />}

            <div className="top-avatar">{avatarLetter}</div>
          </div>
        </header>

        <div className="page-content">
          {active === 'Admin Dashboard' && isSuperAdmin ? (
            <AdminDashboard />
          ) : active === 'Doctor Dashboard' && isDoctor ? (
            <DoctorDashboard />
          ) : active === 'Patient Profile' && !isSuperAdmin && !isDoctor ? (
            <PatientProfile />
          ) : active === 'Health Records' && !isSuperAdmin && !isDoctor ? (
            <PatientHealthRecords />
          ) : active === 'Appointments' && !isSuperAdmin && !isDoctor ? (
            <Appointments />
          ) : active === 'My Consultations' &&
            !isSuperAdmin &&
            !isDoctor ? (
            <ConsultationHistory />
          ) : active === 'Doctors' ? (
            <DoctorDirectory />
          ) : active === 'Overview' ? (
            <>
              <div className="welcome-row">
                <div>
                  <span className="eyebrow">
                    YOUR PERSONAL HEALTH SPACE
                  </span>
                  <h1>Health starts here.</h1>
                  <p>
                    Welcome to YDHYA. Your health journey,
                    organized in one place.
                  </p>
                </div>

                <div className="date-chip">
                  <CalendarDays size={16} />
                  Your health workspace
                </div>
              </div>

              <section className="hero-card">
                <div className="hero-copy">
                  <span className="hero-label">
                    <Sparkles size={14} />
                    YDHYA HEALTH ASSISTANT
                  </span>

                  <h2>
                    Understand your health.
                    <br />
                    Make informed decisions.
                  </h2>

                  <p>
                    Explore health information, understand reports
                    and organize your care journey with YDHYA.
                  </p>

                  <button
                    className="primary-button"
                    onClick={() => selectPage('AI Health Assistant')}
                  >
                    Explore AI Assistant
                    <ArrowUpRight size={17} />
                  </button>
                </div>

                <div className="hero-art">
                  <div className="pulse-ring">
                    <HeartPulse size={76} />
                  </div>
                  <span>YOUR HEALTH, IN FOCUS</span>
                </div>
              </section>

              <div className="section-heading">
                <div>
                  <h2>Your health workspace</h2>
                  <p>Quick access to your health tools</p>
                </div>
              </div>

              <div className="feature-grid">
                {[
                  {
                    name: 'Symptom Assessment',
                    detail: 'Record and understand symptoms',
                    icon: Activity,
                    color: 'mint',
                  },
                  {
                    name: 'Medical Reports',
                    detail: 'Review your medical documents',
                    icon: FileText,
                    color: 'blue',
                  },
                  {
                    name: 'Image Assessment',
                    detail: 'Analyze visible image features',
                    icon: Image,
                    color: 'purple',
                  },
                  {
                    name: 'Find a Doctor',
                    detail: 'Explore medical specialties',
                    icon: Stethoscope,
                    color: 'orange',
                    target: 'Doctors',
                  },
                ].map(item => {
                  const Icon = item.icon

                  return (
                    <button
                      className="feature-card"
                      key={item.name}
                      onClick={() =>
                        selectPage(item.target || item.name)
                      }
                    >
                      <div className={`feature-icon ${item.color}`}>
                        <Icon size={23} />
                      </div>
                      <strong>{item.name}</strong>
                      <span>{item.detail}</span>
                      <ChevronRight className="feature-arrow" size={18} />
                    </button>
                  )
                })}
              </div>

              <div className="lower-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Health activity</h3>
                      <p>Your recent workspace activity</p>
                    </div>
                    <Activity size={20} />
                  </div>

                  <div className="empty-state">
                    <div className="empty-icon">
                      <ClipboardList size={27} />
                    </div>
                    <strong>Your health journey starts here</strong>
                    <p>
                      Your saved assessments and reports will appear here.
                    </p>
                    <button
                      className="text-button"
                      onClick={() => selectPage('Health Records')}
                    >
                      View health records
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Quick actions</h3>
                      <p>Manage your care</p>
                    </div>
                    <Plus size={20} />
                  </div>

                  <div className="quick-list">
                    <button onClick={() => selectPage('Appointments')}>
                      <span className="quick-icon">
                        <CalendarDays />
                      </span>
                      <span>
                        <strong>Appointments</strong>
                        <small>Manage consultation requests</small>
                      </span>
                      <ChevronRight />
                    </button>

                    <button onClick={() => selectPage('My Consultations')}>
                      <span className="quick-icon">
                        <ClipboardList />
                      </span>
                      <span>
                        <strong>My Consultations</strong>
                        <small>View consultation history</small>
                      </span>
                      <ChevronRight />
                    </button>

                    <button onClick={() => selectPage('Medications')}>
                      <span className="quick-icon">
                        <Pill />
                      </span>
                      <span>
                        <strong>Medications</strong>
                        <small>Manage your reminders</small>
                      </span>
                      <ChevronRight />
                    </button>

                    <button
                      onClick={() => selectPage('Membership & Payments')}
                    >
                      <span className="quick-icon">
                        <CreditCard />
                      </span>
                      <span>
                        <strong>Membership</strong>
                        <small>Explore membership options</small>
                      </span>
                      <ChevronRight />
                    </button>

                    <button onClick={() => selectPage('Patient Profile')}>
                      <span className="quick-icon">
                        <UserRound />
                      </span>
                      <span>
                        <strong>Patient Profile</strong>
                        <small>View and update your profile</small>
                      </span>
                      <ChevronRight />
                    </button>
                  </div>
                </section>
              </div>

              <div className="disclaimer">
                <ShieldCheck size={17} />
                <span>
                  YDHYA provides health information, not a confirmed
                  diagnosis or a replacement for professional medical
                  care. Seek urgent medical help for emergencies.
                </span>
              </div>
            </>
          ) : (
            <section className="module-page">
              <span className="eyebrow">YDHYA WORKSPACE</span>

              <div className="module-title">
                <div>
                  <h1>{active}</h1>
                  <p>
                    {descriptions[active] ||
                      'Explore your YDHYA workspace.'}
                  </p>
                </div>
                <div className="module-symbol">
                  <HeartPulse size={30} />
                </div>
              </div>

              <div className="module-panel">
                <div className="module-empty-icon">
                  <Clock size={30} />
                </div>

                <h2>{active} module</h2>
                <p>
                  This section is included in the YDHYA platform.
                  Its database, forms and backend functions will be
                  implemented in upcoming development steps.
                </p>

                {active === 'Membership & Payments' && (
                  <div className="membership-preview">
                    <span>ANNUAL MEMBERSHIP</span>
                    <strong>YDHYA Membership</strong>
                    <p>
                      Your selected plan and verified payment history
                      will appear here.
                    </p>
                  </div>
                )}

                {active === 'AI Health Assistant' && (
                  <div className="membership-preview">
                    <span>HEALTH INFORMATION</span>
                    <strong>AI Assistant</strong>
                    <p>
                      Health information only. Not a substitute
                      for a qualified clinician.
                    </p>
                  </div>
                )}

                <button
                  className="primary-button"
                  onClick={() => selectPage('Overview')}
                >
                  Back to Overview
                  <ArrowUpRight size={17} />
                </button>
              </div>

              <div className="disclaimer">
                <ShieldCheck size={17} />
                <span>
                  Patient information will be protected with
                  appropriate consent, access controls and
                  privacy safeguards.
                </span>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
