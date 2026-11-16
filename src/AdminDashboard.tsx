
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Users,
  UserCheck,
  UserX,
  Search,
  RefreshCw,
  ShieldCheck,
  Ban,
  CheckCircle,
  AlertCircle,
  Stethoscope,
  Clock3,
  XCircle,
  MapPin,
  GraduationCap,
  IndianRupee,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import './AdminDashboard.css'

type Patient = {
  id: string
  full_name: string | null
  phone: string | null
  account_status: 'active' | 'suspended'
  created_at: string
  suspended_at: string | null
  suspension_reason: string | null
}

type Doctor = {
  id: string
  user_id: string | null
  full_name: string
  department: string
  qualification: string | null
  experience_years: number | null
  hospital_name: string | null
  city: string | null
  state: string | null
  consultation_fee: number | null
  consultation_mode: string[] | null
  languages: string[] | null
  bio: string | null
  review_status: 'pending' | 'approved' | 'rejected'
  is_verified: boolean
  is_active: boolean
  created_at: string
}

type DoctorTab = 'pending' | 'approved' | 'rejected'

export default function AdminDashboard() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])

  const [search, setSearch] = useState('')
  const [doctorSearch, setDoctorSearch] = useState('')
  const [doctorTab, setDoctorTab] = useState<DoctorTab>('pending')

  const [loading, setLoading] = useState(true)
  const [doctorLoading, setDoctorLoading] = useState(true)

  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadPatients = useCallback(async () => {
    setLoading(true)

    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select(
        'id, full_name, phone, account_status, created_at, suspended_at, suspension_reason'
      )
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error(fetchError)
      setError(fetchError.message)
      setPatients([])
    } else {
      setPatients((data ?? []) as Patient[])
    }

    setLoading(false)
  }, [])

  const loadDoctors = useCallback(async () => {
    setDoctorLoading(true)

    const { data, error: fetchError } = await supabase
      .from('doctors')
      .select(
        'id, user_id, full_name, department, qualification, experience_years, hospital_name, city, state, consultation_fee, consultation_mode, languages, bio, review_status, is_verified, is_active, created_at'
      )
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error(fetchError)
      setError(fetchError.message)
      setDoctors([])
    } else {
      setDoctors((data ?? []) as Doctor[])
    }

    setDoctorLoading(false)
  }, [])

  const refreshAll = useCallback(async () => {
    setError('')
    await Promise.all([loadPatients(), loadDoctors()])
  }, [loadPatients, loadDoctors])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  const activeCount = patients.filter(
    patient => patient.account_status === 'active'
  ).length

  const suspendedCount = patients.filter(
    patient => patient.account_status === 'suspended'
  ).length

  const pendingCount = doctors.filter(
    doctor => doctor.review_status === 'pending'
  ).length

  const approvedCount = doctors.filter(
    doctor => doctor.review_status === 'approved'
  ).length

  const rejectedCount = doctors.filter(
    doctor => doctor.review_status === 'rejected'
  ).length

  const filteredPatients = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) return patients

    return patients.filter(patient =>
      [
        patient.full_name ?? '',
        patient.phone ?? '',
        patient.id,
      ].some(value => value.toLowerCase().includes(term))
    )
  }, [patients, search])

  const filteredDoctors = useMemo(() => {
    const term = doctorSearch.trim().toLowerCase()

    return doctors.filter(doctor => {
      const matchesTab = doctor.review_status === doctorTab

      const matchesSearch = [
        doctor.full_name,
        doctor.department,
        doctor.qualification ?? '',
        doctor.hospital_name ?? '',
        doctor.city ?? '',
        doctor.state ?? '',
      ].some(value => value.toLowerCase().includes(term))

      return matchesTab && matchesSearch
    })
  }, [doctors, doctorTab, doctorSearch])

  const updatePatientStatus = async (
    patient: Patient,
    newStatus: 'active' | 'suspended'
  ) => {
    let reason: string | null = null

    if (newStatus === 'suspended') {
      reason = window.prompt(
        `Enter a reason for suspending ${patient.full_name || 'this patient'}:`
      )

      if (reason === null) return

      if (!reason.trim()) {
        setError('Please enter a suspension reason.')
        return
      }
    } else {
      const confirmed = window.confirm(
        `Restore access for ${patient.full_name || 'this patient'}?`
      )

      if (!confirmed) return
    }

    setUpdatingId(patient.id)
    setError('')
    setNotice('')

    const { error: updateError } = await supabase.rpc(
      'admin_update_patient_status',
      {
        p_target_user_id: patient.id,
        p_new_status: newStatus,
        p_reason: reason,
      }
    )

    if (updateError) {
      console.error(updateError)
      setError(updateError.message)
    } else {
      setNotice(
        newStatus === 'suspended'
          ? 'Patient account status updated to suspended.'
          : 'Patient account status updated to active.'
      )

      await loadPatients()
    }

    setUpdatingId(null)
  }

  const reviewDoctor = async (
    doctor: Doctor,
    decision: 'approved' | 'rejected'
  ) => {
    const action = decision === 'approved' ? 'approve' : 'reject'

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${doctor.full_name}'s application?`
    )

    if (!confirmed) return

    setReviewingId(doctor.id)
    setError('')
    setNotice('')

    const { error: reviewError } = await supabase.rpc(
      'admin_review_doctor',
      {
        p_doctor_id: doctor.id,
        p_decision: decision,
      }
    )

    if (reviewError) {
      console.error(reviewError)
      setError(reviewError.message)
    } else {
      setNotice(
        decision === 'approved'
          ? `${doctor.full_name}'s application has been approved.`
          : `${doctor.full_name}'s application has been rejected.`
      )

      await loadDoctors()
    }

    setReviewingId(null)
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <div>
          <span className="admin-eyebrow">
            <ShieldCheck size={15} />
            SUPER ADMIN CONTROL CENTER
          </span>

          <h1>YDHYA Administration</h1>

          <p>Manage patient accounts and doctor applications.</p>
        </div>

        <button
          className="admin-refresh"
          onClick={() => void refreshAll()}
          disabled={loading || doctorLoading}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="admin-message error">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {notice && (
        <div className="admin-message success">
          <CheckCircle size={18} />
          {notice}
        </div>
      )}

      {/* DOCTOR APPLICATIONS */}

      <section className="admin-doctor-section">
        <div className="admin-section-heading">
          <div>
            <span className="admin-eyebrow">
              <Stethoscope size={15} />
              MEDICAL PROFESSIONALS
            </span>

            <h2>Doctor Applications</h2>

            <p>Review and manage doctors registering with YDHYA.</p>
          </div>
        </div>

        <div className="admin-doctor-stats">
          <button
            className={`admin-doctor-stat ${doctorTab === 'pending' ? 'selected' : ''}`}
            onClick={() => setDoctorTab('pending')}
          >
            <Clock3 size={21} />
            <span>Pending</span>
            <strong>{pendingCount}</strong>
          </button>

          <button
            className={`admin-doctor-stat ${doctorTab === 'approved' ? 'selected' : ''}`}
            onClick={() => setDoctorTab('approved')}
          >
            <UserCheck size={21} />
            <span>Approved</span>
            <strong>{approvedCount}</strong>
          </button>

          <button
            className={`admin-doctor-stat ${doctorTab === 'rejected' ? 'selected' : ''}`}
            onClick={() => setDoctorTab('rejected')}
          >
            <XCircle size={21} />
            <span>Rejected</span>
            <strong>{rejectedCount}</strong>
          </button>
        </div>

        <div className="admin-doctor-panel">
          <div className="admin-panel-header">
            <div>
              <h2>
                {doctorTab === 'pending'
                  ? 'Pending Applications'
                  : doctorTab === 'approved'
                    ? 'Approved Doctors'
                    : 'Rejected Applications'}
              </h2>

              <p>Doctor profiles submitted through the doctor registration portal.</p>
            </div>

            <span className="admin-total-label">
              {filteredDoctors.length} records
            </span>
          </div>

          <div className="admin-search">
            <Search size={19} />

            <input
              type="search"
              placeholder="Search doctor, specialty, hospital or city..."
              value={doctorSearch}
              onChange={event => setDoctorSearch(event.target.value)}
            />
          </div>

          {doctorLoading ? (
            <div className="admin-empty">
              <RefreshCw className="admin-spinner" size={26} />
              <p>Loading doctor applications...</p>
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div className="admin-empty">
              <Stethoscope size={30} />
              <strong>No applications found</strong>
              <p>
                {doctorSearch
                  ? 'Try another search term.'
                  : `Doctor applications with ${doctorTab} status will appear here.`}
              </p>
            </div>
          ) : (
            <div className="admin-doctor-list">
              {filteredDoctors.map(doctor => (
                <article className="admin-doctor-card" key={doctor.id}>
                  <div className="admin-doctor-card-header">
                    <div className="admin-doctor-avatar">
                      <Stethoscope size={23} />
                    </div>

                    <div className="admin-doctor-main">
                      <h3>{doctor.full_name}</h3>
                      <p>{doctor.department}</p>
                      <span className={`admin-status ${doctor.review_status}`}>
                        {doctor.review_status}
                      </span>
                    </div>
                  </div>

                  <div className="admin-doctor-details">
                    <div>
                      <GraduationCap size={16} />
                      <span>{doctor.qualification || 'Qualification not provided'}</span>
                    </div>

                    <div>
                      <Stethoscope size={16} />
                      <span>
                        {doctor.experience_years ?? 0} years experience
                      </span>
                    </div>

                    <div>
                      <MapPin size={16} />
                      <span>
                        {[doctor.hospital_name, doctor.city, doctor.state]
                          .filter(Boolean)
                          .join(', ') || 'Hospital/location not provided'}
                      </span>
                    </div>

                    <div>
                      <IndianRupee size={16} />
                      <span>
                        {doctor.consultation_fee != null
                          ? `₹${doctor.consultation_fee} consultation fee`
                          : 'Fee not provided'}
                      </span>
                    </div>
                  </div>

                  {doctor.consultation_mode?.length ? (
                    <p className="admin-doctor-meta">
                      Consultation: {doctor.consultation_mode.join(', ')}
                    </p>
                  ) : null}

                  {doctor.languages?.length ? (
                    <p className="admin-doctor-meta">
                      Languages: {doctor.languages.join(', ')}
                    </p>
                  ) : null}

                  {doctor.bio && (
                    <p className="admin-doctor-bio">{doctor.bio}</p>
                  )}

                  <p className="admin-doctor-date">
                    Submitted:{' '}
                    {new Date(doctor.created_at).toLocaleDateString('en-IN')}
                  </p>

                  {doctorTab === 'pending' && (
                    <div className="admin-doctor-actions">
                      <button
                        className="admin-action restore"
                        disabled={reviewingId === doctor.id}
                        onClick={() => void reviewDoctor(doctor, 'approved')}
                      >
                        <CheckCircle size={16} />
                        {reviewingId === doctor.id ? 'Processing...' : 'Approve'}
                      </button>

                      <button
                        className="admin-action suspend"
                        disabled={reviewingId === doctor.id}
                        onClick={() => void reviewDoctor(doctor, 'rejected')}
                      >
                        <XCircle size={16} />
                        Reject
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* PATIENT MANAGEMENT */}

      <div className="admin-section-heading admin-patient-heading">
        <div>
          <span className="admin-eyebrow">
            <Users size={15} />
            PATIENT ACCOUNTS
          </span>

          <h2>Patient Management</h2>
          <p>View registered patient profiles and manage account status.</p>
        </div>
      </div>

      <div className="admin-stats">
        <div className="admin-stat-card">
          <div className="admin-stat-icon total">
            <Users size={22} />
          </div>
          <span>Total Patients</span>
          <strong>{patients.length}</strong>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon active">
            <UserCheck size={22} />
          </div>
          <span>Active Accounts</span>
          <strong>{activeCount}</strong>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon suspended">
            <UserX size={22} />
          </div>
          <span>Suspended Accounts</span>
          <strong>{suspendedCount}</strong>
        </div>
      </div>

      <section className="admin-patient-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Registered Patients</h2>
            <p>Patient accounts stored in your YDHYA database.</p>
          </div>

          <span className="admin-total-label">
            {filteredPatients.length} records
          </span>
        </div>

        <div className="admin-search">
          <Search size={19} />

          <input
            type="search"
            placeholder="Search by patient name, phone or ID..."
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </div>

        {loading ? (
          <div className="admin-empty">
            <RefreshCw className="admin-spinner" size={26} />
            <p>Loading patient records...</p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="admin-empty">
            <Users size={30} />
            <strong>No patients found</strong>
            <p>
              {search
                ? 'Try another search term.'
                : 'Registered patient profiles will appear here.'}
            </p>
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-patient-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Phone</th>
                  <th>Registered</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredPatients.map(patient => (
                  <tr key={patient.id}>
                    <td>
                      <div className="admin-patient-name">
                        <div className="admin-patient-avatar">
                          {(patient.full_name || 'P').charAt(0).toUpperCase()}
                        </div>

                        <div>
                          <strong>{patient.full_name || 'Unnamed Patient'}</strong>
                          <small>ID: {patient.id.slice(0, 8)}...</small>
                        </div>
                      </div>
                    </td>

                    <td>{patient.phone || 'Not provided'}</td>

                    <td>
                      {new Date(patient.created_at).toLocaleDateString('en-IN')}
                    </td>

                    <td>
                      <span className={`admin-status ${patient.account_status}`}>
                        {patient.account_status}
                      </span>
                    </td>

                    <td>
                      {patient.account_status === 'active' ? (
                        <button
                          className="admin-action suspend"
                          disabled={updatingId === patient.id}
                          onClick={() =>
                            void updatePatientStatus(patient, 'suspended')
                          }
                        >
                          <Ban size={15} />
                          {updatingId === patient.id ? 'Updating...' : 'Suspend'}
                        </button>
                      ) : (
                        <button
                          className="admin-action restore"
                          disabled={updatingId === patient.id}
                          onClick={() =>
                            void updatePatientStatus(patient, 'active')
                          }
                        >
                          <CheckCircle size={15} />
                          {updatingId === patient.id ? 'Updating...' : 'Restore'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="admin-security-note">
        <ShieldCheck size={16} />
        Administrative actions use protected Supabase functions and database
        access policies. Patient suspension currently updates account status
        metadata; it does not by itself revoke existing sessions.
      </p>
    </div>
  )
}
