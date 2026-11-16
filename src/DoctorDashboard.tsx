
import { useEffect, useState, type FormEvent } from 'react'
import {
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  Languages,
  MapPin,
  Save,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Video,
  IndianRupee,
  AlertCircle,
  LoaderCircle,
  CalendarDays,
  RefreshCw,
} from 'lucide-react'

import { supabase } from './lib/supabase'
import VideoConsultation from './VideoConsultation'
import './DoctorDashboard.css'

interface Doctor {
  id: string
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
  is_verified: boolean
  is_active: boolean
}

interface DoctorAppointment {
  id: string
  patient_id: string
  appointment_date: string
  start_time: string
  end_time: string
  reason: string | null
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
}

interface DoctorAvailability {
  id?: string
  doctor_id: string
  day_of_week: string
  start_time: string
  end_time: string
  is_available: boolean
}

interface DoctorConsultation {
  id: string
  appointment_id: string
  patient_id: string
  doctor_id: string
  consultation_mode: 'Online' | 'In-person'
  status:
    | 'scheduled'
    | 'waiting'
    | 'checked_in'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
  created_at: string
  doctor_notes: string | null
  follow_up_instructions: string | null
}

const WEEK_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

const DEFAULT_SCHEDULE: DoctorAvailability[] = WEEK_DAYS.map(day => ({
  doctor_id: '',
  day_of_week: day,
  start_time: '09:00',
  end_time: '17:00',
  is_available: day !== 'Sunday',
}))

export default function DoctorDashboard() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [profileExists, setProfileExists] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    department: '',
    qualification: '',
    experience_years: '0',
    hospital_name: '',
    city: '',
    state: '',
    consultation_fee: '',
    consultation_mode: ['In-person'] as string[],
    languages: 'English',
    bio: '',
  })

  const [status, setStatus] = useState({
    is_verified: false,
    is_active: false,
  })

  // APPOINTMENT STATE
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(false)
  const [appointmentError, setAppointmentError] = useState('')
  const [appointmentSuccess, setAppointmentSuccess] = useState('')
  const [appointmentActionId, setAppointmentActionId] = useState('')

  // CONSULTATION STATE
  const [consultations, setConsultations] = useState<DoctorConsultation[]>([])
  const [consultationsLoading, setConsultationsLoading] = useState(false)
  const [consultationsError, setConsultationsError] = useState('')
  const [activeConsultationId, setActiveConsultationId] = useState('')

  // WEEKLY AVAILABILITY STATE
  const [schedule, setSchedule] =
    useState<DoctorAvailability[]>(DEFAULT_SCHEDULE)

  const [doctorId, setDoctorId] = useState('')
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [availabilitySaving, setAvailabilitySaving] = useState(false)
  const [availabilityError, setAvailabilityError] = useState('')
  const [availabilitySuccess, setAvailabilitySuccess] = useState('')

  useEffect(() => {
    void initializeDashboard()
  }, [])

  const initializeDashboard = async () => {
    await loadProfile()
    await loadAppointments()
    await loadConsultations()
  }

  // LOAD DOCTOR PROFILE
  const loadProfile = async () => {
    setLoading(true)
    setError('')

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser()

      if (authError) throw authError
      if (!auth.user) throw new Error('Please log in again.')

      const { data, error: dbError } = await supabase
        .from('doctors')
        .select('*')
        .eq('user_id', auth.user.id)
        .maybeSingle()

      if (dbError) throw dbError

      if (data) {
        const doctor = data as Doctor

        setProfileExists(true)
        setDoctorId(doctor.id)

        setForm({
          full_name: doctor.full_name || '',
          department: doctor.department || '',
          qualification: doctor.qualification || '',
          experience_years: String(doctor.experience_years ?? 0),
          hospital_name: doctor.hospital_name || '',
          city: doctor.city || '',
          state: doctor.state || '',
          consultation_fee:
            doctor.consultation_fee != null
              ? String(doctor.consultation_fee)
              : '',
          consultation_mode: doctor.consultation_mode || ['In-person'],
          languages: (doctor.languages || ['English']).join(', '),
          bio: doctor.bio || '',
        })

        setStatus({
          is_verified: doctor.is_verified,
          is_active: doctor.is_active,
        })

        await loadAvailability(doctor.id)
      } else {
        setProfileExists(false)
        setDoctorId('')
        setSchedule(
          DEFAULT_SCHEDULE.map(day => ({ ...day, doctor_id: '' }))
        )
      }
    } catch (err: unknown) {
      console.error('Doctor profile loading error:', err)
      setError(
        err instanceof Error ? err.message : 'Unable to load profile.'
      )
    } finally {
      setLoading(false)
    }
  }

  // LOAD APPOINTMENTS
  const loadAppointments = async () => {
    setAppointmentsLoading(true)
    setAppointmentError('')

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser()

      if (authError) throw authError
      if (!auth.user) throw new Error('Please log in again.')

      const { data: doctor, error: doctorError } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', auth.user.id)
        .maybeSingle()

      if (doctorError) throw doctorError

      if (!doctor) {
        setAppointments([])
        return
      }

      const { data, error: dbError } = await supabase
        .from('appointments')
        .select('*')
        .eq('doctor_id', doctor.id)
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true })

      if (dbError) throw dbError

      setAppointments((data || []) as DoctorAppointment[])
    } catch (err: unknown) {
      console.error('Appointment loading error:', err)
      setAppointmentError(
        err instanceof Error
          ? err.message
          : 'Unable to load appointments.'
      )
    } finally {
      setAppointmentsLoading(false)
    }
  }

  // LOAD DOCTOR CONSULTATIONS
  const loadConsultations = async () => {
    setConsultationsLoading(true)
    setConsultationsError('')

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser()

      if (authError) throw authError
      if (!auth.user) throw new Error('Please log in again.')

      const { data: doctor, error: doctorError } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', auth.user.id)
        .maybeSingle()

      if (doctorError) throw doctorError

      if (!doctor) {
        setConsultations([])
        return
      }

      const { data, error: dbError } = await supabase
        .from('consultations')
        .select(`
          id,
          appointment_id,
          patient_id,
          doctor_id,
          consultation_mode,
          status,
          created_at,
          doctor_notes,
          follow_up_instructions
        `)
        .eq('doctor_id', doctor.id)
        .order('created_at', { ascending: false })

      if (dbError) throw dbError

      setConsultations((data || []) as DoctorConsultation[])
    } catch (err: unknown) {
      console.error('Consultation loading error:', err)
      setConsultationsError(
        err instanceof Error
          ? err.message
          : 'Unable to load consultations.'
      )
    } finally {
      setConsultationsLoading(false)
    }
  }

  // CONFIRM OR CANCEL APPOINTMENT
  const updateAppointment = async (
    appointmentId: string,
    newStatus: 'confirmed' | 'cancelled'
  ) => {
    setAppointmentActionId(appointmentId)
    setAppointmentError('')
    setAppointmentSuccess('')

    try {
      const { error: updateError } = await supabase.rpc(
        'doctor_update_appointment',
        {
          p_appointment_id: appointmentId,
          p_new_status: newStatus,
        }
      )

      if (updateError) throw updateError

      setAppointmentSuccess(
        newStatus === 'confirmed'
          ? 'Appointment confirmed successfully.'
          : 'Appointment cancelled successfully.'
      )

      await loadAppointments()
      await loadConsultations()
    } catch (err: unknown) {
      console.error('Appointment update error:', err)
      setAppointmentError(
        err instanceof Error
          ? err.message
          : 'Unable to update appointment.'
      )
    } finally {
      setAppointmentActionId('')
    }
  }

  // LOAD WEEKLY AVAILABILITY
  const loadAvailability = async (currentDoctorId?: string) => {
    setAvailabilityLoading(true)
    setAvailabilityError('')

    try {
      let activeDoctorId = currentDoctorId || doctorId

      if (!activeDoctorId) {
        const { data: auth, error: authError } =
          await supabase.auth.getUser()

        if (authError) throw authError
        if (!auth.user) throw new Error('Please log in again.')

        const { data: doctor, error: doctorError } = await supabase
          .from('doctors')
          .select('id')
          .eq('user_id', auth.user.id)
          .maybeSingle()

        if (doctorError) throw doctorError

        if (!doctor) {
          setAvailabilityError(
            'Save your professional profile before setting availability.'
          )
          return
        }

        activeDoctorId = doctor.id
        setDoctorId(doctor.id)
      }

      const { data, error: dbError } = await supabase
        .from('doctor_availability')
        .select('*')
        .eq('doctor_id', activeDoctorId)

      if (dbError) throw dbError

      const saved = (data || []) as DoctorAvailability[]

      setSchedule(
        WEEK_DAYS.map(day => {
          const existing = saved.find(
            item => item.day_of_week === day
          )

          if (existing) {
            return {
              ...existing,
              start_time: existing.start_time.slice(0, 5),
              end_time: existing.end_time.slice(0, 5),
            }
          }

          return {
            doctor_id: activeDoctorId,
            day_of_week: day,
            start_time: '09:00',
            end_time: '17:00',
            is_available: day !== 'Sunday',
          }
        })
      )
    } catch (err: unknown) {
      console.error('Availability loading error:', err)
      setAvailabilityError(
        err instanceof Error
          ? err.message
          : 'Unable to load availability.'
      )
    } finally {
      setAvailabilityLoading(false)
    }
  }

  // CHANGE WEEKLY SCHEDULE
  const updateSchedule = (
    day: string,
    field: 'start_time' | 'end_time' | 'is_available',
    value: string | boolean
  ) => {
    setSchedule(previous =>
      previous.map(item =>
        item.day_of_week === day
          ? { ...item, [field]: value }
          : item
      )
    )
  }

  // SAVE WEEKLY SCHEDULE
  const saveAvailability = async () => {
    setAvailabilityError('')
    setAvailabilitySuccess('')

    if (!doctorId) {
      setAvailabilityError(
        'Please save your professional profile first.'
      )
      return
    }

    for (const day of schedule) {
      if (day.is_available) {
        if (!day.start_time || !day.end_time) {
          setAvailabilityError(
            `Enter working hours for ${day.day_of_week}.`
          )
          return
        }

        if (day.end_time <= day.start_time) {
          setAvailabilityError(
            `End time must be later than start time on ${day.day_of_week}.`
          )
          return
        }
      }
    }

    setAvailabilitySaving(true)

    try {
      const records = schedule.map(day => ({
        doctor_id: doctorId,
        day_of_week: day.day_of_week,
        start_time: day.start_time,
        end_time: day.end_time,
        is_available: day.is_available,
        updated_at: new Date().toISOString(),
      }))

      const { error: saveError } = await supabase
        .from('doctor_availability')
        .upsert(records, {
          onConflict: 'doctor_id,day_of_week',
        })

      if (saveError) throw saveError

      setAvailabilitySuccess(
        'Your weekly availability has been saved successfully.'
      )

      await loadAvailability(doctorId)
    } catch (err: unknown) {
      console.error('Availability save error:', err)
      setAvailabilityError(
        err instanceof Error
          ? err.message
          : 'Unable to save availability.'
      )
    } finally {
      setAvailabilitySaving(false)
    }
  }

  // PROFILE FORM HELPERS
  const change = (field: string, value: string) => {
    setForm(previous => ({ ...previous, [field]: value }))
  }

  const toggleMode = (mode: string) => {
    setForm(previous => ({
      ...previous,
      consultation_mode: previous.consultation_mode.includes(mode)
        ? previous.consultation_mode.filter(item => item !== mode)
        : [...previous.consultation_mode, mode],
    }))
  }

  // SAVE PROFESSIONAL PROFILE
  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (
      !form.full_name.trim() ||
      !form.department.trim() ||
      !form.qualification.trim()
    ) {
      setError('Please complete all required fields.')
      return
    }

    if (!form.consultation_mode.length) {
      setError('Select at least one consultation mode.')
      return
    }

    const experience = Number(form.experience_years)
    const fee = form.consultation_fee
      ? Number(form.consultation_fee)
      : null

    if (
      !Number.isInteger(experience) ||
      experience < 0 ||
      experience > 80
    ) {
      setError('Enter a valid experience between 0 and 80 years.')
      return
    }

    if (fee !== null && (!Number.isFinite(fee) || fee < 0)) {
      setError('Enter a valid consultation fee.')
      return
    }

    setSaving(true)

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser()

      if (authError) throw authError
      if (!auth.user) throw new Error('Please log in again.')

      const profileData = {
        full_name: form.full_name.trim(),
        department: form.department.trim(),
        qualification: form.qualification.trim(),
        experience_years: experience,
        hospital_name: form.hospital_name.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        consultation_fee: fee,
        consultation_mode: form.consultation_mode,
        languages: form.languages
          .split(',')
          .map(item => item.trim())
          .filter(Boolean),
        bio: form.bio.trim() || null,
        updated_at: new Date().toISOString(),
      }

      const { data: existing, error: lookupError } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', auth.user.id)
        .maybeSingle()

      if (lookupError) throw lookupError

      let savedDoctorId = existing?.id || ''

      if (existing) {
        const { error: updateError } = await supabase
          .from('doctors')
          .update(profileData)
          .eq('id', existing.id)
          .eq('user_id', auth.user.id)

        if (updateError) throw updateError
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('doctors')
          .insert(profileData)
          .select('id')
          .single()

        if (insertError) throw insertError

        savedDoctorId = inserted.id
      }

      setDoctorId(savedDoctorId)
      setProfileExists(true)
      setSuccess('Your professional profile has been saved.')

      const { data: updated, error: statusError } = await supabase
        .from('doctors')
        .select('is_verified, is_active')
        .eq('user_id', auth.user.id)
        .maybeSingle()

      if (statusError) throw statusError

      if (updated) {
        setStatus({
          is_verified: updated.is_verified,
          is_active: updated.is_active,
        })
      }

      await loadAvailability(savedDoctorId)
      await loadConsultations()
    } catch (err: unknown) {
      console.error('Doctor profile save error:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save profile.'
      )
    } finally {
      setSaving(false)
    }
  }

  const verified = status.is_verified && status.is_active

  const checklist = [
    ['Full name', !!form.full_name.trim()],
    ['Specialization', !!form.department.trim()],
    ['Qualification', !!form.qualification.trim()],
    ['City', !!form.city.trim()],
    ['Professional bio', !!form.bio.trim()],
  ]

  const pendingCount = appointments.filter(
    appointment => appointment.status === 'pending'
  ).length

  const confirmedCount = appointments.filter(
    appointment => appointment.status === 'confirmed'
  ).length

  const cancelledCount = appointments.filter(
    appointment => appointment.status === 'cancelled'
  ).length

  const activeConsultationStatuses = [
    'scheduled',
    'waiting',
    'checked_in',
    'in_progress',
  ]

  if (loading) {
    return (
      <div className="yd-doctor-loading">
        <LoaderCircle className="yd-spin" size={32} />
        <p>Loading your doctor profile...</p>
      </div>
    )
  }

  return (
    <div className="yd-doctor-page">
      <div className="yd-page-heading">
        <div>
          <span className="yd-eyebrow">DOCTOR WORKSPACE</span>
          <h1>Doctor Dashboard</h1>
          <p>Manage your professional details and YDHYA doctor profile.</p>
        </div>

        <div className="yd-account-chip">
          <Stethoscope size={17} />
          Doctor Account
        </div>
      </div>

      <div className={`yd-status-banner ${verified ? 'approved' : ''}`}>
        <div className="yd-status-symbol">
          {verified ? <CheckCircle2 size={23} /> : <Clock3 size={23} />}
        </div>

        <div className="yd-status-copy">
          <strong>
            {verified
              ? 'Your profile is approved'
              : 'Profile awaiting approval'}
          </strong>

          <p>
            {verified
              ? 'Your doctor profile is verified and active in the directory.'
              : 'Complete your professional profile. The Super Admin will review and approve it before it appears in the public directory.'}
          </p>
        </div>

        <span className="yd-status-label">
          {verified ? 'ACTIVE' : 'PENDING'}
        </span>
      </div>

      {error && (
        <div className="yd-message yd-message-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="yd-message yd-message-success">
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* APPOINTMENT MANAGEMENT */}
      <section className="yd-appointments-section">
        <div className="yd-appointments-heading">
          <div>
            <span className="yd-eyebrow">PATIENT BOOKINGS</span>
            <h2>
              <CalendarDays size={21} />
              Appointment Management
            </h2>
            <p>Review and manage your patient appointment requests.</p>
          </div>

          <button
            type="button"
            className="yd-refresh-button"
            onClick={loadAppointments}
            disabled={appointmentsLoading}
          >
            <RefreshCw
              size={17}
              className={appointmentsLoading ? 'yd-spin' : ''}
            />
            Refresh
          </button>
        </div>

        {appointmentError && (
          <div className="yd-message yd-message-error">
            <AlertCircle size={18} />
            <span>{appointmentError}</span>
          </div>
        )}

        {appointmentSuccess && (
          <div className="yd-message yd-message-success">
            <CheckCircle2 size={18} />
            <span>{appointmentSuccess}</span>
          </div>
        )}

        <div className="yd-appointment-counts">
          <div>
            <strong>{pendingCount}</strong>
            <span>Pending</span>
          </div>
          <div>
            <strong>{confirmedCount}</strong>
            <span>Confirmed</span>
          </div>
          <div>
            <strong>{cancelledCount}</strong>
            <span>Cancelled</span>
          </div>
        </div>

        {appointmentsLoading ? (
          <div className="yd-appointment-empty">
            <LoaderCircle className="yd-spin" size={25} />
            <p>Loading appointments...</p>
          </div>
        ) : appointments.length === 0 ? (
          <div className="yd-appointment-empty">
            <CalendarDays size={32} />
            <h3>No appointments yet</h3>
            <p>New patient booking requests will appear here.</p>
          </div>
        ) : (
          <div className="yd-appointment-list">
            {appointments.map(appointment => (
              <article className="yd-appointment-card" key={appointment.id}>
                <div className="yd-appointment-card-top">
                  <div>
                    <span className="yd-appointment-label">
                      PATIENT REQUEST
                    </span>
                    <h3>Patient appointment</h3>
                    <small>
                      Patient reference: {appointment.patient_id.slice(0, 8)}
                    </small>
                  </div>

                  <span className={`yd-appointment-status ${appointment.status}`}>
                    {appointment.status.toUpperCase()}
                  </span>
                </div>

                <div className="yd-appointment-details">
                  <div>
                    <CalendarDays size={17} />
                    <span>{appointment.appointment_date}</span>
                  </div>

                  <div>
                    <Clock3 size={17} />
                    <span>
                      {appointment.start_time.slice(0, 5)} –{' '}
                      {appointment.end_time.slice(0, 5)}
                    </span>
                  </div>
                </div>

                {appointment.reason && (
                  <div className="yd-appointment-reason">
                    <strong>Reason for appointment</strong>
                    <p>{appointment.reason}</p>
                  </div>
                )}

                {appointment.status === 'pending' && (
                  <div className="yd-appointment-actions">
                    <button
                      type="button"
                      className="yd-confirm-button"
                      disabled={!!appointmentActionId}
                      onClick={() =>
                        updateAppointment(appointment.id, 'confirmed')
                      }
                    >
                      {appointmentActionId === appointment.id
                        ? 'Updating...'
                        : 'Confirm'}
                    </button>

                    <button
                      type="button"
                      className="yd-cancel-button"
                      disabled={!!appointmentActionId}
                      onClick={() =>
                        updateAppointment(appointment.id, 'cancelled')
                      }
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* DOCTOR CONSULTATIONS */}
      <section className="yd-appointments-section">
        <div className="yd-appointments-heading">
          <div>
            <span className="yd-eyebrow">ONLINE & IN-PERSON CARE</span>
            <h2>
              <Video size={21} />
              Doctor Consultations
            </h2>
            <p>View confirmed consultations and open online call rooms.</p>
          </div>

          <button
            type="button"
            className="yd-refresh-button"
            onClick={loadConsultations}
            disabled={consultationsLoading}
          >
            <RefreshCw
              size={17}
              className={consultationsLoading ? 'yd-spin' : ''}
            />
            Refresh
          </button>
        </div>

        {consultationsError && (
          <div className="yd-message yd-message-error">
            <AlertCircle size={18} />
            <span>{consultationsError}</span>
          </div>
        )}

        {consultationsLoading ? (
          <div className="yd-appointment-empty">
            <LoaderCircle className="yd-spin" size={25} />
            <p>Loading consultations...</p>
          </div>
        ) : consultations.length === 0 ? (
          <div className="yd-appointment-empty">
            <Video size={32} />
            <h3>No consultations yet</h3>
            <p>
              Consultations will appear here after you confirm patient appointments.
            </p>
          </div>
        ) : (
          <div className="yd-appointment-list">
            {consultations.map(consultation => (
              <article className="yd-appointment-card" key={consultation.id}>
                <div className="yd-appointment-card-top">
                  <div>
                    <span className="yd-appointment-label">
                      {consultation.consultation_mode.toUpperCase()} CONSULTATION
                    </span>
                    <h3>Patient consultation</h3>
                    <small>
                      Reference: {consultation.id.slice(0, 8)}
                    </small>
                  </div>

                  <span
                    className={`yd-appointment-status ${
                      consultation.status === 'completed'
                        ? 'completed'
                        : consultation.status === 'cancelled'
                          ? 'cancelled'
                          : 'confirmed'
                    }`}
                  >
                    {consultation.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                <div className="yd-appointment-details">
                  <div>
                    <UserRound size={17} />
                    <span>
                      Patient reference: {consultation.patient_id.slice(0, 8)}
                    </span>
                  </div>

                  <div>
                    {consultation.consultation_mode === 'Online' ? (
                      <Video size={17} />
                    ) : (
                      <Building2 size={17} />
                    )}
                    <span>{consultation.consultation_mode}</span>
                  </div>
                </div>

                {consultation.consultation_mode === 'Online' &&
                  activeConsultationStatuses.includes(consultation.status) && (
                    <div className="yd-appointment-actions">
                      <button
                        type="button"
                        className="yd-confirm-button"
                        onClick={() =>
                          setActiveConsultationId(consultation.id)
                        }
                      >
                        <Video size={16} />
                        Join video consultation
                      </button>
                    </div>
                  )}

                {consultation.consultation_mode === 'In-person' && (
                  <div className="yd-appointment-reason">
                    <strong>In-person appointment</strong>
                    <p>
                      Meet the patient at your registered hospital or clinic.
                    </p>
                  </div>
                )}

                {consultation.doctor_notes && (
                  <div className="yd-appointment-reason">
                    <strong>Doctor notes</strong>
                    <p>{consultation.doctor_notes}</p>
                  </div>
                )}

                {consultation.follow_up_instructions && (
                  <div className="yd-appointment-reason">
                    <strong>Follow-up instructions</strong>
                    <p>{consultation.follow_up_instructions}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* WEEKLY AVAILABILITY */}
      <section className="yd-availability-section">
        <div className="yd-appointments-heading">
          <div>
            <span className="yd-eyebrow">WORKING HOURS</span>
            <h2>
              <CalendarDays size={21} />
              Weekly Availability
            </h2>
            <p>
              Choose the days and hours when patients can request appointments.
            </p>
          </div>

          <button
            type="button"
            className="yd-refresh-button"
            onClick={() => loadAvailability()}
            disabled={availabilityLoading || !doctorId}
          >
            <RefreshCw
              size={17}
              className={availabilityLoading ? 'yd-spin' : ''}
            />
            Refresh
          </button>
        </div>

        {availabilityError && (
          <div className="yd-message yd-message-error">
            <AlertCircle size={18} />
            <span>{availabilityError}</span>
          </div>
        )}

        {availabilitySuccess && (
          <div className="yd-message yd-message-success">
            <CheckCircle2 size={18} />
            <span>{availabilitySuccess}</span>
          </div>
        )}

        {!doctorId ? (
          <div className="yd-appointment-empty">
            <CalendarDays size={30} />
            <p>Save your professional profile first to set working hours.</p>
          </div>
        ) : availabilityLoading ? (
          <div className="yd-appointment-empty">
            <LoaderCircle className="yd-spin" size={25} />
            <p>Loading weekly availability...</p>
          </div>
        ) : (
          <>
            <div className="yd-availability-list">
              {schedule.map(day => (
                <div
                  className={`yd-availability-row ${
                    day.is_available ? 'available' : 'unavailable'
                  }`}
                  key={day.day_of_week}
                >
                  <div className="yd-availability-day">
                    <strong>{day.day_of_week}</strong>
                    <span>
                      {day.is_available ? 'Working day' : 'Day off'}
                    </span>
                  </div>

                  <label className="yd-availability-toggle">
                    <input
                      type="checkbox"
                      checked={day.is_available}
                      onChange={event =>
                        updateSchedule(
                          day.day_of_week,
                          'is_available',
                          event.target.checked
                        )
                      }
                    />
                    <span>
                      {day.is_available ? 'Available' : 'Unavailable'}
                    </span>
                  </label>

                  <div className="yd-availability-times">
                    <label>
                      <span>Start time</span>
                      <input
                        type="time"
                        value={day.start_time}
                        disabled={!day.is_available}
                        onChange={event =>
                          updateSchedule(
                            day.day_of_week,
                            'start_time',
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      <span>End time</span>
                      <input
                        type="time"
                        value={day.end_time}
                        disabled={!day.is_available}
                        onChange={event =>
                          updateSchedule(
                            day.day_of_week,
                            'end_time',
                            event.target.value
                          )
                        }
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="yd-availability-save"
              onClick={saveAvailability}
              disabled={availabilitySaving}
            >
              {availabilitySaving ? (
                <LoaderCircle className="yd-spin" size={18} />
              ) : (
                <Save size={18} />
              )}

              {availabilitySaving
                ? 'Saving schedule...'
                : 'Save Weekly Availability'}
            </button>
          </>
        )}
      </section>

      {/* PROFESSIONAL PROFILE FORM */}
      <form onSubmit={saveProfile} className="yd-doctor-form">
        <section className="yd-form-section">
          <div className="yd-section-heading">
            <div className="yd-section-icon">
              <UserRound size={20} />
            </div>
            <div>
              <h2>Professional Information</h2>
              <p>Your name, specialization and qualifications.</p>
            </div>
          </div>

          <div className="yd-fields-grid">
            <label className="yd-field">
              <span>Full name <em>*</em></span>
              <input
                value={form.full_name}
                onChange={event => change('full_name', event.target.value)}
                placeholder="Enter your full name"
                required
              />
            </label>

            <label className="yd-field">
              <span>Department / Specialization <em>*</em></span>
              <input
                value={form.department}
                onChange={event => change('department', event.target.value)}
                placeholder="Example: Cardiology"
                required
              />
            </label>

            <label className="yd-field">
              <span>Qualification <em>*</em></span>
              <input
                value={form.qualification}
                onChange={event => change('qualification', event.target.value)}
                placeholder="Example: MBBS, MD"
                required
              />
            </label>

            <label className="yd-field">
              <span>Years of experience</span>
              <input
                type="number"
                min="0"
                max="80"
                step="1"
                value={form.experience_years}
                onChange={event =>
                  change('experience_years', event.target.value)
                }
              />
            </label>

            <label className="yd-field yd-field-wide">
              <span>Professional bio</span>
              <textarea
                rows={4}
                value={form.bio}
                onChange={event => change('bio', event.target.value)}
                placeholder="Describe your professional experience and approach to patient care..."
              />
            </label>
          </div>
        </section>

        <section className="yd-form-section">
          <div className="yd-section-heading">
            <div className="yd-section-icon">
              <Building2 size={20} />
            </div>
            <div>
              <h2>Hospital & Location</h2>
              <p>Tell patients where you practice.</p>
            </div>
          </div>

          <div className="yd-fields-grid">
            <label className="yd-field yd-field-wide">
              <span>Hospital / Clinic name</span>
              <input
                value={form.hospital_name}
                onChange={event => change('hospital_name', event.target.value)}
                placeholder="Enter hospital or clinic name"
              />
            </label>

            <label className="yd-field">
              <span>City</span>
              <input
                value={form.city}
                onChange={event => change('city', event.target.value)}
                placeholder="Enter city"
              />
            </label>

            <label className="yd-field">
              <span>State</span>
              <input
                value={form.state}
                onChange={event => change('state', event.target.value)}
                placeholder="Enter state"
              />
            </label>
          </div>
        </section>

        <section className="yd-form-section">
          <div className="yd-section-heading">
            <div className="yd-section-icon">
              <Video size={20} />
            </div>
            <div>
              <h2>Consultation Settings</h2>
              <p>Choose how patients can consult you.</p>
            </div>
          </div>

          <div className="yd-fields-grid">
            <div className="yd-field yd-field-wide">
              <span>Consultation mode <em>*</em></span>

              <div className="yd-mode-grid">
                <button
                  type="button"
                  className={
                    form.consultation_mode.includes('In-person')
                      ? 'yd-mode-card selected'
                      : 'yd-mode-card'
                  }
                  onClick={() => toggleMode('In-person')}
                >
                  <Building2 size={21} />
                  <span>
                    <strong>In-person</strong>
                    <small>At hospital or clinic</small>
                  </span>
                  {form.consultation_mode.includes('In-person') && (
                    <CheckCircle2 size={18} />
                  )}
                </button>

                <button
                  type="button"
                  className={
                    form.consultation_mode.includes('Online')
                      ? 'yd-mode-card selected'
                      : 'yd-mode-card'
                  }
                  onClick={() => toggleMode('Online')}
                >
                  <Video size={21} />
                  <span>
                    <strong>Online</strong>
                    <small>Virtual consultation</small>
                  </span>
                  {form.consultation_mode.includes('Online') && (
                    <CheckCircle2 size={18} />
                  )}
                </button>
              </div>
            </div>

            <label className="yd-field">
              <span>Consultation fee (₹)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.consultation_fee}
                onChange={event =>
                  change('consultation_fee', event.target.value)
                }
                placeholder="Enter fee"
              />
            </label>

            <label className="yd-field">
              <span>Languages</span>
              <input
                value={form.languages}
                onChange={event => change('languages', event.target.value)}
                placeholder="English, Telugu, Hindi"
              />
              <small>Separate languages with commas.</small>
            </label>
          </div>
        </section>

        {/* PROFILE PREVIEW AND CHECKLIST */}
        <div className="yd-preview-section">
          <section className="yd-preview-card">
            <div className="yd-preview-top">
              <div className="yd-preview-avatar">
                {form.full_name
                  ? form.full_name.charAt(0).toUpperCase()
                  : <Stethoscope size={27} />}
              </div>

              <div className="yd-preview-name">
                <span>PROFILE PREVIEW</span>
                <h2>{form.full_name || 'Your full name'}</h2>
                <p>{form.department || 'Your specialization'}</p>
              </div>
            </div>

            <div className="yd-preview-details">
              <div>
                <FileText size={17} />
                <span>{form.qualification || 'Qualification not added'}</span>
              </div>

              <div>
                <MapPin size={17} />
                <span>
                  {[form.city, form.state].filter(Boolean).join(', ') ||
                    'Location not added'}
                </span>
              </div>

              <div>
                <Clock3 size={17} />
                <span>{form.experience_years || '0'} years experience</span>
              </div>

              <div>
                <IndianRupee size={17} />
                <span>
                  {form.consultation_fee
                    ? `₹${form.consultation_fee}`
                    : 'Fee not added'}
                </span>
              </div>

              <div>
                <Languages size={17} />
                <span>{form.languages || 'Languages not added'}</span>
              </div>
            </div>

            {form.bio && (
              <p className="yd-preview-bio">{form.bio}</p>
            )}
          </section>

          <section className="yd-checklist-card">
            <div className="yd-checklist-heading">
              <ShieldCheck size={20} />
              <h3>Profile checklist</h3>
            </div>

            {checklist.map(([label, done]) => (
              <div className="yd-check-row" key={String(label)}>
                <CheckCircle2
                  size={17}
                  className={done ? 'completed' : ''}
                />
                <span>{label}</span>
                <small>{done ? 'Added' : 'Pending'}</small>
              </div>
            ))}
          </section>
        </div>

        <div className="yd-save-bar">
          <div>
            <strong>
              {profileExists
                ? 'Update your professional profile'
                : 'Ready to submit your profile?'}
            </strong>
            <span>Your changes will be saved to your YDHYA account.</span>
          </div>

          <button type="submit" disabled={saving}>
            {saving ? (
              <LoaderCircle className="yd-spin" size={18} />
            ) : (
              <Save size={18} />
            )}
            {saving ? 'Saving...' : 'Save professional profile'}
          </button>
        </div>
      </form>

      <footer className="yd-doctor-footer">
        <span>Bavyesh's YDHYA</span>
        <span>Doctor Portal</span>
      </footer>

      {/* VIDEO CONSULTATION ROOM */}
      {activeConsultationId && (
        <div className="yd-video-consultation-overlay">
          <div className="yd-video-consultation-container">
            <button
              type="button"
              className="yd-refresh-button"
              onClick={() => {
                setActiveConsultationId('')
                void loadConsultations()
              }}
            >
              Close consultation
            </button>

            <VideoConsultation
              consultationId={activeConsultationId}
              onClose={() => {
                setActiveConsultationId('')
                void loadConsultations()
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
