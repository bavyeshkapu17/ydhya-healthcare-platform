
import { useCallback, useEffect, useState } from 'react'
import {
  CalendarDays,
  Clock,
  Video,
  Hospital,
  Stethoscope,
  FileText,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  ClipboardList,
  ArrowLeft,
} from 'lucide-react'

import { supabase } from './lib/supabase'
import VideoConsultation from './VideoConsultation'
import './ConsultationHistory.css'

interface Consultation {
  id: string
  appointment_id: string
  patient_id: string
  doctor_id: string
  consultation_mode: 'Online' | 'In-person'
  status: string
  doctor_notes: string | null
  follow_up_instructions: string | null
  meeting_url: string | null
  created_at: string
}

interface Appointment {
  id: string
  appointment_date: string
  start_time: string
  end_time: string
  reason: string | null
}

interface Doctor {
  id: string
  full_name: string
  department: string
  hospital_name: string | null
  city: string | null
  state: string | null
  consultation_fee: number | null
}

interface ConsultationItem {
  consultation: Consultation
  appointment?: Appointment
  doctor?: Doctor
}

const ACTIVE_STATUSES = [
  'scheduled',
  'waiting',
  'checked_in',
  'in_progress',
]

const formatTime = (time: string) => {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'

  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${period}`
}

const formatDate = (date: string) => {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const ConsultationHistory = () => {
  const [items, setItems] = useState<ConsultationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeConsultationId, setActiveConsultationId] = useState<string | null>(null)

  const loadConsultations = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser()

      if (userError) throw userError
      if (!userData.user) throw new Error('Please sign in again.')

      const { data: consultationData, error: consultationError } =
        await supabase
          .from('consultations')
          .select('*')
          .eq('patient_id', userData.user.id)
          .order('created_at', { ascending: false })

      if (consultationError) throw consultationError

      const consultations = (consultationData || []) as Consultation[]

      if (consultations.length === 0) {
        setItems([])
        return
      }

      const appointmentIds = [
        ...new Set(consultations.map(item => item.appointment_id)),
      ]

      const doctorIds = [
        ...new Set(consultations.map(item => item.doctor_id)),
      ]

      const [
        { data: appointmentData, error: appointmentError },
        { data: doctorData, error: doctorError },
      ] = await Promise.all([
        supabase
          .from('appointments')
          .select('id, appointment_date, start_time, end_time, reason')
          .in('id', appointmentIds),

        supabase
          .from('doctors')
          .select(
            'id, full_name, department, hospital_name, city, state, consultation_fee'
          )
          .in('id', doctorIds),
      ])

      if (appointmentError) throw appointmentError
      if (doctorError) throw doctorError

      const appointmentMap = new Map(
        ((appointmentData || []) as Appointment[]).map(item => [
          item.id,
          item,
        ])
      )

      const doctorMap = new Map(
        ((doctorData || []) as Doctor[]).map(item => [
          item.id,
          item,
        ])
      )

      setItems(
        consultations.map(consultation => ({
          consultation,
          appointment: appointmentMap.get(consultation.appointment_id),
          doctor: doctorMap.get(consultation.doctor_id),
        }))
      )
    } catch (err) {
      console.error('Consultation history error:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load consultation history.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConsultations()
  }, [loadConsultations])

  if (activeConsultationId) {
    return (
      <div className="yd-video-fullscreen">
        <button
          type="button"
          className="yd-video-back"
          onClick={() => setActiveConsultationId(null)}
        >
          <ArrowLeft size={18} />
          Back to My Consultations
        </button>

        <VideoConsultation
          consultationId={activeConsultationId}
          onClose={() => setActiveConsultationId(null)}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="yd-consultation-loading">
        <Loader2 className="spin" size={32} />
        <p>Loading consultation history...</p>
      </div>
    )
  }

  return (
    <div className="yd-consultation-page">
      <header className="yd-consultation-header">
        <div>
          <span>BAVYESH'S YDHYA</span>
          <h1>My Consultations</h1>
          <p>View your confirmed consultations, notes and follow-ups.</p>
        </div>

        <button
          type="button"
          onClick={() => void loadConsultations()}
          disabled={loading}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </header>

      {error && (
        <div className="yd-consultation-error">
          <XCircle size={19} />
          {error}
        </div>
      )}

      <div className="yd-consultation-summary">
        <div>
          <ClipboardList size={23} />
          <strong>{items.length}</strong>
          <span>Total consultations</span>
        </div>

        <div>
          <CheckCircle size={23} />
          <strong>
            {items.filter(
              item => item.consultation.status === 'completed'
            ).length}
          </strong>
          <span>Completed</span>
        </div>

        <div>
          <CalendarDays size={23} />
          <strong>
            {items.filter(item =>
              ACTIVE_STATUSES.includes(item.consultation.status)
            ).length}
          </strong>
          <span>Upcoming / Active</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="yd-consultation-empty">
          <Stethoscope size={38} />
          <h2>No consultations yet</h2>
          <p>
            Once a doctor confirms your appointment, its consultation
            will appear here.
          </p>
        </div>
      ) : (
        <div className="yd-consultation-list">
          {items.map(({ consultation, appointment, doctor }) => {
            const canJoin =
              consultation.consultation_mode === 'Online' &&
              ACTIVE_STATUSES.includes(consultation.status)

            return (
              <article
                className="yd-consultation-card"
                key={consultation.id}
              >
                <div className="yd-consultation-card-top">
                  <div className="yd-consultation-doctor">
                    <div className="yd-consultation-avatar">
                      <Stethoscope size={23} />
                    </div>

                    <div>
                      <h2>{doctor?.full_name || 'Doctor'}</h2>
                      <p>{doctor?.department || 'Medical consultation'}</p>
                    </div>
                  </div>

                  <span
                    className={`yd-consultation-status ${consultation.status}`}
                  >
                    {consultation.status.replaceAll('_', ' ')}
                  </span>
                </div>

                <div className="yd-consultation-details">
                  <div>
                    {consultation.consultation_mode === 'Online' ? (
                      <Video size={17} />
                    ) : (
                      <Hospital size={17} />
                    )}
                    <span>{consultation.consultation_mode}</span>
                  </div>

                  {appointment && (
                    <>
                      <div>
                        <CalendarDays size={17} />
                        <span>{formatDate(appointment.appointment_date)}</span>
                      </div>

                      <div>
                        <Clock size={17} />
                        <span>
                          {formatTime(appointment.start_time)} –{' '}
                          {formatTime(appointment.end_time)}
                        </span>
                      </div>
                    </>
                  )}

                  {consultation.consultation_mode === 'In-person' && (
                    <div>
                      <Hospital size={17} />
                      <span>
                        {doctor?.hospital_name || 'Hospital details unavailable'}
                        {doctor?.city ? `, ${doctor.city}` : ''}
                        {doctor?.state ? `, ${doctor.state}` : ''}
                      </span>
                    </div>
                  )}
                </div>

                {appointment?.reason && (
                  <div className="yd-consultation-note">
                    <strong>Appointment reason</strong>
                    <p>{appointment.reason}</p>
                  </div>
                )}

                {consultation.doctor_notes && (
                  <div className="yd-consultation-note">
                    <strong>
                      <FileText size={16} />
                      Doctor's notes
                    </strong>
                    <p>{consultation.doctor_notes}</p>
                  </div>
                )}

                {consultation.follow_up_instructions && (
                  <div className="yd-consultation-note">
                    <strong>Follow-up instructions</strong>
                    <p>{consultation.follow_up_instructions}</p>
                  </div>
                )}

                {canJoin && (
                  <div className="yd-consultation-join-area">
                    <p>
                      Your online consultation is available. Join when
                      you and your doctor are ready.
                    </p>

                    <button
                      type="button"
                      className="yd-consultation-join"
                      onClick={() =>
                        setActiveConsultationId(consultation.id)
                      }
                    >
                      <Video size={19} />
                      Join Consultation
                    </button>
                  </div>
                )}

                {consultation.consultation_mode === 'Online' &&
                  !canJoin && (
                    <p className="yd-consultation-info">
                      {consultation.status === 'completed'
                        ? 'This consultation has been completed.'
                        : consultation.status === 'cancelled'
                          ? 'This consultation has been cancelled.'
                          : 'Online meeting is not currently available.'}
                    </p>
                  )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ConsultationHistory
