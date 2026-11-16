
import { useEffect, useMemo, useState } from 'react'
import {
  Search,
  Stethoscope,
  MapPin,
  BriefcaseMedical,
  Languages,
  Video,
  Building2,
  RefreshCw,
  AlertCircle,
  Loader2,
  UserRound,
  BadgeCheck,
  X,
  HeartPulse,
  SlidersHorizontal,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react'

import { supabase } from './lib/supabase'
import './DoctorDirectory.css'

interface Doctor {
  id: string
  full_name: string
  department: string
  qualification: string | null
  experience_years: number | null
  hospital_name: string | null
  consultation_mode: string[] | null
  consultation_fee: number | null
  profile_image_url: string | null
  bio: string | null
  languages: string[] | null
  city: string | null
  state: string | null
}

const ALL = 'All'

export default function DoctorDirectory() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState(ALL)
  const [mode, setMode] = useState(ALL)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDoctors = async () => {
    setLoading(true)
    setError('')

    const { data, error: queryError } = await supabase
      .from('doctors')
      .select(`
        id,
        full_name,
        department,
        qualification,
        experience_years,
        hospital_name,
        consultation_mode,
        consultation_fee,
        profile_image_url,
        bio,
        languages,
        city,
        state
      `)
      .eq('is_verified', true)
      .eq('is_active', true)
      .order('full_name', { ascending: true })

    if (queryError) {
      setError(queryError.message)
      setDoctors([])
    } else {
      setDoctors((data ?? []) as Doctor[])
    }

    setLoading(false)
  }

  useEffect(() => {
    void loadDoctors()
  }, [])

  const departments = useMemo(
    () =>
      Array.from(
        new Set(
          doctors
            .map(doctor => doctor.department?.trim())
            .filter((value): value is string => Boolean(value))
        )
      ).sort(),
    [doctors]
  )

  const modes = useMemo(
    () =>
      Array.from(
        new Set(
          doctors.flatMap(doctor => doctor.consultation_mode ?? [])
        )
      ).sort(),
    [doctors]
  )

  const filteredDoctors = useMemo(() => {
    const term = search.trim().toLowerCase()

    return doctors.filter(doctor => {
      const searchableText = [
        doctor.full_name,
        doctor.department,
        doctor.qualification ?? '',
        doctor.hospital_name ?? '',
        doctor.city ?? '',
        doctor.state ?? '',
      ].join(' ').toLowerCase()

      const matchesSearch = !term || searchableText.includes(term)

      const matchesDepartment =
        department === ALL || doctor.department === department

      const matchesMode =
        mode === ALL ||
        (doctor.consultation_mode ?? []).includes(mode)

      return matchesSearch && matchesDepartment && matchesMode
    })
  }, [doctors, search, department, mode])

  const departmentCounts = useMemo(
    () =>
      departments.map(name => ({
        name,
        count: doctors.filter(doctor => doctor.department === name).length,
      })),
    [departments, doctors]
  )

  const clearFilters = () => {
    setSearch('')
    setDepartment(ALL)
    setMode(ALL)
  }

  const hasFilters =
    Boolean(search.trim()) || department !== ALL || mode !== ALL

  const onlineDoctors = doctors.filter(doctor =>
    (doctor.consultation_mode ?? []).some(item =>
      item.toLowerCase().includes('online')
    )
  ).length

  const hospitalCount = new Set(
    doctors
      .map(doctor => doctor.hospital_name?.trim())
      .filter(Boolean)
  ).size

  return (
    <main className="ydhya-directory">

      {/* DASHBOARD HEADER */}
      <section className="ydhya-dashboard-hero">
        <div className="ydhya-dashboard-hero-content">
          <span className="ydhya-eyebrow">
            <HeartPulse size={16} />
            BAVYESH'S YDHYA HEALTHCARE
          </span>

          <h1>
            Find care that
            <br />
            <span>puts you first.</span>
          </h1>

          <p>
            Discover verified doctors, explore medical specialties
            and find consultation options for your healthcare needs.
          </p>

          <button
            type="button"
            className="ydhya-explore-button"
            onClick={() => {
              document
                .getElementById('ydhya-doctor-search')
                ?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            Explore doctors
            <ArrowUpRight size={17} />
          </button>
        </div>

        <div className="ydhya-hero-visual">
          <div className="ydhya-hero-visual-circle">
            <HeartPulse size={76} strokeWidth={1.3} />
          </div>
          <div className="ydhya-hero-floating-card">
            <ShieldCheck size={19} />
            <span>
              <strong>Verified professionals</strong>
              <small>Trusted doctor profiles</small>
            </span>
          </div>
        </div>
      </section>

      {/* LIVE STATISTICS */}
      <section className="ydhya-dashboard-stats">
        <article className="ydhya-dashboard-stat">
          <div className="ydhya-stat-icon green">
            <Stethoscope size={21} />
          </div>
          <div>
            <strong>{loading ? '—' : doctors.length}</strong>
            <span>Verified doctors</span>
          </div>
        </article>

        <article className="ydhya-dashboard-stat">
          <div className="ydhya-stat-icon blue">
            <BriefcaseMedical size={21} />
          </div>
          <div>
            <strong>{loading ? '—' : departments.length}</strong>
            <span>Departments</span>
          </div>
        </article>

        <article className="ydhya-dashboard-stat">
          <div className="ydhya-stat-icon purple">
            <Video size={21} />
          </div>
          <div>
            <strong>{loading ? '—' : onlineDoctors}</strong>
            <span>Online consultation</span>
          </div>
        </article>

        <article className="ydhya-dashboard-stat">
          <div className="ydhya-stat-icon orange">
            <Building2 size={21} />
          </div>
          <div>
            <strong>{loading ? '—' : hospitalCount}</strong>
            <span>Listed hospitals</span>
          </div>
        </article>
      </section>

      {/* DEPARTMENTS */}
      <section className="ydhya-department-section">
        <div className="ydhya-section-heading">
          <div>
            <span className="ydhya-section-kicker">EXPLORE SPECIALTIES</span>
            <h2>Browse by department</h2>
            <p>Choose a specialty to discover matching doctors.</p>
          </div>
        </div>

        <div className="ydhya-department-grid">
          <button
            type="button"
            className={`ydhya-department-card ${
              department === ALL ? 'selected' : ''
            }`}
            onClick={() => setDepartment(ALL)}
          >
            <div className="ydhya-department-icon">
              <HeartPulse size={22} />
            </div>
            <strong>All departments</strong>
            <span>{doctors.length} doctors</span>
          </button>

          {departmentCounts.map(item => (
            <button
              type="button"
              key={item.name}
              className={`ydhya-department-card ${
                department === item.name ? 'selected' : ''
              }`}
              onClick={() => setDepartment(item.name)}
            >
              <div className="ydhya-department-icon">
                <Stethoscope size={22} />
              </div>
              <strong>{item.name}</strong>
              <span>
                {item.count} {item.count === 1 ? 'doctor' : 'doctors'}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* SEARCH AND FILTERS */}
      <section
        className="ydhya-directory-search-panel"
        id="ydhya-doctor-search"
      >
        <div className="ydhya-section-heading">
          <div>
            <span className="ydhya-section-kicker">YDHYA MEDICAL NETWORK</span>
            <h2>Find your doctor</h2>
            <p>Search verified doctors by name, specialty or location.</p>
          </div>
        </div>

        <div className="ydhya-search-input">
          <Search size={21} />

          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Doctor name, specialty, hospital or city..."
            aria-label="Search doctors"
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
            >
              <X size={17} />
            </button>
          )}
        </div>

        <div className="ydhya-filter-row">
          <label className="ydhya-filter-control">
            <SlidersHorizontal size={17} />
            <select
              value={department}
              onChange={event => setDepartment(event.target.value)}
              aria-label="Filter department"
            >
              <option value={ALL}>All departments</option>
              {departments.map(item => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="ydhya-filter-control">
            <Video size={17} />
            <select
              value={mode}
              onChange={event => setMode(event.target.value)}
              aria-label="Filter consultation mode"
            >
              <option value={ALL}>All consultation modes</option>
              {modes.map(item => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          {hasFilters && (
            <button
              type="button"
              className="ydhya-reset-filters"
              onClick={clearFilters}
            >
              <X size={15} />
              Clear filters
            </button>
          )}
        </div>
      </section>

      {/* DOCTOR RESULTS */}
      <section className="ydhya-directory-results">
        <div className="ydhya-results-heading">
          <div>
            <span className="ydhya-section-kicker">MEET OUR PROFESSIONALS</span>
            <h2>Available doctors</h2>
            <p>
              {loading
                ? 'Loading verified doctors...'
                : `${filteredDoctors.length} doctor${filteredDoctors.length === 1 ? '' : 's'} found`}
            </p>
          </div>

          <button
            type="button"
            className="ydhya-refresh-button"
            onClick={() => void loadDoctors()}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={loading ? 'ydhya-refresh-spin' : ''}
            />
            Refresh
          </button>
        </div>

        {error && (
          <div className="ydhya-directory-error" role="alert">
            <AlertCircle size={19} />
            <span>{error}</span>
            <button type="button" onClick={() => void loadDoctors()}>
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <div className="ydhya-directory-state">
            <Loader2 size={34} className="ydhya-loader" />
            <h3>Finding the right care</h3>
            <p>Loading verified doctor profiles...</p>
          </div>
        ) : !error && filteredDoctors.length === 0 ? (
          <div className="ydhya-directory-empty">
            <div className="ydhya-empty-icon">
              <Stethoscope size={30} />
            </div>
            <h3>No doctors found</h3>
            <p>
              {doctors.length === 0
                ? 'No verified and active doctors are listed yet.'
                : 'Try changing your search or filters.'}
            </p>
            {hasFilters && (
              <button type="button" onClick={clearFilters}>
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="ydhya-doctor-grid">
            {filteredDoctors.map(doctor => (
              <article className="ydhya-doctor-card" key={doctor.id}>
                <div className="ydhya-doctor-card-header">
                  <div className="ydhya-doctor-avatar">
                    {doctor.profile_image_url ? (
                      <img
                        src={doctor.profile_image_url}
                        alt={doctor.full_name}
                        loading="lazy"
                        onError={event => {
                          event.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <UserRound size={38} />
                    )}
                  </div>

                  <span className="ydhya-verified-badge">
                    <BadgeCheck size={15} />
                    Verified
                  </span>
                </div>

                <div className="ydhya-doctor-main">
                  <span className="ydhya-doctor-specialty">
                    {doctor.department}
                  </span>

                  <h3>{doctor.full_name}</h3>

                  <p className="ydhya-doctor-qualification">
                    {doctor.qualification || 'Qualification not listed'}
                  </p>

                  <div className="ydhya-doctor-divider" />

                  <div className="ydhya-doctor-info">
                    <div>
                      <BriefcaseMedical size={16} />
                      <span>
                        {doctor.experience_years != null
                          ? `${doctor.experience_years} years experience`
                          : 'Experience not listed'}
                      </span>
                    </div>

                    <div>
                      <Building2 size={16} />
                      <span>
                        {doctor.hospital_name || 'Hospital not listed'}
                      </span>
                    </div>

                    {(doctor.city || doctor.state) && (
                      <div>
                        <MapPin size={16} />
                        <span>
                          {[doctor.city, doctor.state]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </div>
                    )}

                    <div>
                      <Languages size={16} />
                      <span>
                        {doctor.languages?.length
                          ? doctor.languages.join(', ')
                          : 'Languages not listed'}
                      </span>
                    </div>
                  </div>

                  {doctor.bio && (
                    <p className="ydhya-doctor-bio">{doctor.bio}</p>
                  )}
                </div>

                <div className="ydhya-doctor-card-footer">
                  <div className="ydhya-doctor-fee">
                    <span>Consultation fee</span>
                    <strong>
                      {doctor.consultation_fee != null
                        ? `₹${Number(doctor.consultation_fee).toLocaleString('en-IN')}`
                        : 'Not listed'}
                    </strong>
                  </div>

                  <div className="ydhya-doctor-modes">
                    {(doctor.consultation_mode ?? []).map(item => (
                      <span key={item}>
                        {item.toLowerCase().includes('online')
                          ? <Video size={13} />
                          : <Building2 size={13} />}
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* FOOTER NOTE */}
      <section className="ydhya-directory-note">
        <ShieldCheck size={20} />
        <div>
          <strong>Your healthcare information matters.</strong>
          <p>
            Doctor profiles displayed here are limited to verified and
            active accounts. Confirm consultation details with the
            provider before booking.
          </p>
        </div>
      </section>
    </main>
  )
}
