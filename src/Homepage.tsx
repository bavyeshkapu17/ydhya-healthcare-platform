
import { useState } from 'react'
import {
  HeartPulse, Menu, X, ArrowRight, ShieldCheck,
  Activity, FileText, Stethoscope, CalendarDays,
  Pill, Brain, Sparkles, CheckCircle2, Clock,
  Users, Heart, ChevronRight
} from 'lucide-react'
import './HomePage.css'

interface HomePageProps {
  onGetStarted: (plan?: string) => void
}

const services = [
  { icon: Brain, title: 'AI Health Assistant', description: 'Explore general health information and healthcare guidance.' },
  { icon: FileText, title: 'Medical Reports', description: 'Organize reports and understand common medical terms.' },
  { icon: Activity, title: 'Digital Health Records', description: 'Keep your health information organized in one place.' },
  { icon: Stethoscope, title: 'Doctor Directory', description: 'Explore doctors across different medical departments.' },
  { icon: CalendarDays, title: 'Appointments', description: 'Request appointments with healthcare professionals.' },
  { icon: Pill, title: 'Medication Reminders', description: 'Organize reminders for medicines prescribed by your doctor.' },
]

const departments = [
  'General Medicine', 'Cardiology', 'Dermatology', 'Neurology',
  'Orthopedics', 'Pediatrics', 'Gynecology', 'ENT',
  'Ophthalmology', 'Dentistry', 'Psychiatry', 'Gastroenterology',
  'Urology', 'Oncology', 'Pulmonology', 'Endocrinology',
]

const plans = [
  {
    name: 'Basic',
    price: '₹7,000',
    description: 'Essential digital health features.',
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
    price: '₹14,000',
    popular: true,
    description: 'More tools to organize your health.',
    features: [
      'Everything in Basic',
      'Advanced Symptom Tracking',
      'Enhanced Report Insights',
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
    price: '₹24,000',
    description: 'Expanded health management features.',
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

export default function HomePage({ onGetStarted }: HomePageProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="homepage" id="home">

      {/* NAVIGATION */}
      <header className="home-header">
        <a href="#home" className="home-logo" onClick={closeMenu}>
          <span className="logo-icon"><HeartPulse size={27} /></span>
          <span>
            <strong>Bavyesh's YDHYA</strong>
            <small>YOUR HEALTH, YOUR WAY</small>
          </span>
        </a>

        <button
          className="mobile-menu-button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation"
        >
          {menuOpen ? <X /> : <Menu />}
        </button>

        <nav className={`home-nav ${menuOpen ? 'nav-open' : ''}`}>
          <a href="#home" onClick={closeMenu}>Home</a>
          <a href="#services" onClick={closeMenu}>Services</a>
          <a href="#departments" onClick={closeMenu}>Departments</a>
          <a href="#about" onClick={closeMenu}>About</a>
          <a href="#membership" onClick={closeMenu}>Membership</a>
          <button className="nav-cta" onClick={() => {
            closeMenu()
            onGetStarted()
          }}>
            Get Started <ArrowRight size={17} />
          </button>
        </nav>
      </header>

      <main>

        {/* HERO */}
        <section className="hero-section">
          <div className="hero-content">
            <div className="hero-tag">
              <Sparkles size={15} />
              YOUR DIGITAL HEALTH COMPANION
            </div>

            <h1>
              Your Health.
              <br />
              Your Records.
              <br />
              <span>Your YDHYA.</span>
            </h1>

            <p className="hero-description">
              A connected digital health platform designed to help
              you organize health information, explore healthcare
              resources and manage your healthcare journey.
            </p>

            <div className="hero-actions">
              <button className="primary-button" onClick={() => onGetStarted()}>
                Get Started <ArrowRight size={18} />
              </button>
              <a href="#services" className="secondary-button">
                Explore Services
              </a>
            </div>

            <div className="hero-trust">
              <ShieldCheck size={19} />
              Designed with privacy and responsible healthcare use in mind
            </div>

            <div className="hero-stat-row">
              <div>
                <strong>One</strong>
                <span>Health platform</span>
              </div>
              <div>
                <strong>16+</strong>
                <span>Medical departments</span>
              </div>
              <div>
                <strong>24/7</strong>
                <span>Digital access</span>
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-glow" />

            <div className="hero-health-card">
              <div className="health-card-top">
                <div className="health-card-logo">
                  <HeartPulse size={27} />
                </div>
                <div>
                  <strong>YDHYA</strong>
                  <span>HEALTH PLATFORM</span>
                </div>
                <span className="live-indicator">●</span>
              </div>

              <div className="health-card-main">
                <span>YOUR HEALTH JOURNEY</span>
                <h2>Everything connected.</h2>
                <p>Organize. Understand. Manage.</p>
                <div className="health-card-wave">
                  <HeartPulse size={64} />
                </div>
              </div>

              <div className="health-card-features">
                <div><FileText /><span>Health Records</span></div>
                <div><Stethoscope /><span>Doctors</span></div>
                <div><CalendarDays /><span>Appointments</span></div>
              </div>
            </div>

            <div className="floating-card floating-top">
              <span className="floating-icon green"><ShieldCheck /></span>
              <div><strong>Privacy focused</strong><small>Your information matters</small></div>
            </div>

            <div className="floating-card floating-bottom">
              <span className="floating-icon mint"><Heart /></span>
              <div><strong>Care simplified</strong><small>Your journey, organized</small></div>
            </div>
          </div>
        </section>

        {/* TRUST STRIP */}
        <section className="trust-strip">
          <div><ShieldCheck /><span>Privacy-conscious design</span></div>
          <div><HeartPulse /><span>Connected health tools</span></div>
          <div><Users /><span>Patient-focused experience</span></div>
          <div><Clock /><span>Convenient digital access</span></div>
        </section>

        {/* SERVICES */}
        <section className="home-section services-section" id="services">
          <div className="section-heading">
            <span className="section-eyebrow">WHAT YDHYA OFFERS</span>
            <h2>Healthcare support, <span>reimagined.</span></h2>
            <p>Explore digital tools designed to help you manage and understand your health information.</p>
          </div>

          <div className="services-grid">
            {services.map((service, index) => {
              const Icon = service.icon
              return (
                <article className="service-card" key={service.title}>
                  <div className="service-card-top">
                    <div className="service-icon"><Icon size={25} /></div>
                    <span className="service-number">0{index + 1}</span>
                  </div>
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                  <button className="service-link" onClick={() => onGetStarted()}>
                    Explore <ArrowRight size={16} />
                  </button>
                </article>
              )
            })}
          </div>
        </section>

        {/* ABOUT */}
        <section className="about-section" id="about">
          <div className="about-visual">
            <div className="about-orbit orbit-one" />
            <div className="about-orbit orbit-two" />
            <div className="about-main-card">
              <div className="about-heart"><HeartPulse size={66} /></div>
              <span>INTRODUCING</span>
              <h3>Bavyesh's YDHYA</h3>
              <p>Scan. Analyze. Heal.</p>
              <div className="about-mini-stats">
                <div><HeartPulse /><span>Health</span></div>
                <div><ShieldCheck /><span>Privacy</span></div>
                <div><Activity /><span>Wellness</span></div>
              </div>
            </div>
          </div>

          <div className="about-content">
            <span className="section-eyebrow">ABOUT YDHYA</span>
            <h2>A more organized way to manage your <span>health journey.</span></h2>
            <p>
              Bavyesh's YDHYA is a digital healthcare platform concept
              that brings health information, digital tools and healthcare
              discovery features together.
            </p>
            <p>
              Our goal is to make it easier to organize health records,
              explore medical departments and manage healthcare-related
              activities from one place.
            </p>

            <div className="about-check-list">
              <div><CheckCircle2 /> Organized health information</div>
              <div><CheckCircle2 /> Healthcare discovery tools</div>
              <div><CheckCircle2 /> Convenient digital experience</div>
            </div>

            <button className="primary-button" onClick={() => onGetStarted()}>
              Explore YDHYA <ArrowRight size={18} />
            </button>
          </div>
        </section>

        {/* DEPARTMENTS */}
        <section className="home-section departments-section" id="departments">
          <div className="section-heading">
            <span className="section-eyebrow">DOCTOR DIRECTORY</span>
            <h2>Explore medical <span>departments.</span></h2>
            <p>Browse medical specialties and explore available healthcare professionals.</p>
          </div>

          <div className="departments-grid">
            {departments.map(department => (
              <button
                className="department-item"
                key={department}
                onClick={() => onGetStarted()}
              >
                <span className="department-icon"><Stethoscope size={19} /></span>
                <span>{department}</span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>

          <p className="department-note">
            Doctor availability and appointment options depend on actual provider partnerships.
          </p>
        </section>

        {/* MEMBERSHIP */}
        <section className="home-section membership-section" id="membership">
          <div className="section-heading">
            <span className="section-eyebrow">MEMBERSHIP PLANS</span>
            <h2>Choose your <span>YDHYA plan.</span></h2>
            <p>Explore the proposed annual membership options.</p>
          </div>

          <div className="membership-grid">
            {plans.map(plan => (
              <article
                className={`membership-card ${plan.popular ? 'popular-plan' : ''}`}
                key={plan.name}
              >
                {plan.popular && <span className="popular-label">MOST POPULAR</span>}

                <h3>{plan.name}</h3>
                <p className="plan-description">{plan.description}</p>

                <div className="plan-price">
                  <strong>{plan.price}</strong>
                  <span>/ year</span>
                </div>

                <div className="plan-divider" />

                <ul className="plan-features">
                  {plan.features.map(feature => (
                    <li key={feature}>
                      <CheckCircle2 size={17} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className={plan.popular ? 'primary-button plan-button' : 'outline-button plan-button'}
                  onClick={() => onGetStarted(plan.name)}
                >
                  Choose {plan.name} <ArrowRight size={17} />
                </button>
              </article>
            ))}
          </div>

          <p className="membership-disclaimer">
            Membership benefits are subject to actual implementation and published terms.
            Consultations, tests, medicines and hospital services may involve separate charges.
          </p>
        </section>

        {/* FINAL CTA */}
        <section className="final-cta-section">
          <div>
            <span className="section-eyebrow">START YOUR JOURNEY</span>
            <h2>Your health journey starts with YDHYA.</h2>
            <p>Explore the platform and choose a membership option.</p>
          </div>
          <button className="cta-white-button" onClick={() => onGetStarted()}>
            Get Started <ArrowRight size={18} />
          </button>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="home-footer">
        <div className="footer-main">
          <div className="footer-brand">
            <a href="#home" className="home-logo">
              <span className="logo-icon"><HeartPulse size={26} /></span>
              <span>
                <strong>Bavyesh's YDHYA</strong>
                <small>YOUR HEALTH, YOUR WAY</small>
              </span>
            </a>
            <p>A digital platform concept for organizing health information and exploring healthcare resources.</p>
          </div>

          <div className="footer-links">
            <h4>Platform</h4>
            <a href="#services">Services</a>
            <a href="#departments">Departments</a>
            <a href="#membership">Membership</a>
          </div>

          <div className="footer-links">
            <h4>Discover</h4>
            <a href="#about">About YDHYA</a>
            <a href="#home">Home</a>
            <button onClick={() => onGetStarted()}>Get Started</button>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Bavyesh's YDHYA. All rights reserved.</p>
          <p>Digital health information is not a substitute for professional medical advice.</p>
        </div>
      </footer>
    </div>
  )
}
