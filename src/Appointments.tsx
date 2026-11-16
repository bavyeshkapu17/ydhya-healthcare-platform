
import { useEffect, useState } from 'react';
import {
  CalendarDays,
  Clock,
  MapPin,
  Search,
  Stethoscope,
  User,
  Loader2,
  CheckCircle,
  XCircle,
  Video,
  Hospital,
} from 'lucide-react';

import { supabase } from './lib/supabase';
import './Appointments.css';

type ConsultationMode = 'Online' | 'In-person';

interface Doctor {
  id: string;
  full_name: string;
  department: string;
  qualification?: string;
  experience_years?: number;
  hospital_name?: string;
  city?: string;
  state?: string;
  consultation_fee?: number;
  consultation_mode?: string[];
  profile_image_url?: string;
  languages?: string[];
  bio?: string;
}

interface Appointment {
  id: string;
  doctor_id: string;
  patient_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
  status: string;
  consultation_mode: ConsultationMode;
  created_at: string;
}

interface TimeSlot {
  start: string;
  end: string;
  bookedCount: number;
}

interface Availability {
  doctor_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface SlotCount {
  slot_start: string;
  booked_count: number;
}

const WEEK_DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const SLOT_CAPACITY = 10;

const formatTime = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const formatDisplayTime = (time: string) => {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
};

const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const Appointments = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [consultationMode, setConsultationMode] =
    useState<ConsultationMode | ''>('');

  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [slotLoading, setSlotLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] =
    useState<'success' | 'error'>('success');

  const today = getLocalDateString(new Date());

  const supportedModes = (doctor: Doctor): ConsultationMode[] => {
    const modes = doctor.consultation_mode || [];

    return (['Online', 'In-person'] as ConsultationMode[]).filter(
      (mode) =>
        modes.some(
          (availableMode) =>
            availableMode.trim().toLowerCase() === mode.toLowerCase()
        )
    );
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const showMessage = (
    text: string,
    type: 'success' | 'error'
  ) => {
    setMessage(text);
    setMessageType(type);
  };

  const loadInitialData = async () => {
    setLoading(true);

    try {
      const { data: doctorData, error: doctorError } = await supabase
        .from('doctors')
        .select('*')
        .eq('is_verified', true)
        .eq('is_active', true)
        .order('full_name');

      if (doctorError) throw doctorError;

      setDoctors((doctorData || []) as Doctor[]);

      await loadAppointments();
    } catch (error) {
      console.error('Loading error:', error);
      showMessage('Unable to load appointment information.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAppointments = async () => {
    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError) throw userError;

    const user = userData.user;

    if (!user) {
      setAppointments([]);
      return;
    }

    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('patient_id', user.id)
      .order('appointment_date', { ascending: false });

    if (error) throw error;

    setAppointments((data || []) as Appointment[]);
  };

  // Load the doctor's working hours and booking counts.
  const loadAvailableSlots = async (
    doctor: Doctor,
    date: string
  ) => {
    setSlotLoading(true);
    setAvailableSlots([]);

    try {
      const selectedDateObject = new Date(`${date}T12:00:00`);
      const dayName = WEEK_DAYS[selectedDateObject.getDay()];

      const { data: availabilityData, error: availabilityError } =
        await supabase
          .from('doctor_availability')
          .select('*')
          .eq('doctor_id', doctor.id)
          .eq('day_of_week', dayName)
          .eq('is_available', true);

      if (availabilityError) throw availabilityError;

      const availability = (availabilityData || []) as Availability[];

      if (availability.length === 0) {
        setAvailableSlots([]);
        return;
      }

      // Secure function returns counts across all patients.
      const { data: countData, error: countError } = await supabase.rpc(
        'get_doctor_slot_counts',
        {
          p_doctor_id: doctor.id,
          p_appointment_date: date,
        }
      );

      if (countError) throw countError;

      const bookedCounts = new Map<string, number>();

      ((countData || []) as SlotCount[]).forEach((item) => {
        bookedCounts.set(
          item.slot_start.slice(0, 5),
          Number(item.booked_count)
        );
      });

      const now = new Date();
      const generatedSlots: TimeSlot[] = [];
      const addedSlots = new Set<string>();

      for (const schedule of availability) {
        const [startHour, startMinute] = schedule.start_time
          .slice(0, 5)
          .split(':')
          .map(Number);

        const [endHour, endMinute] = schedule.end_time
          .slice(0, 5)
          .split(':')
          .map(Number);

        const scheduleStart = startHour * 60 + startMinute;
        const scheduleEnd = endHour * 60 + endMinute;

        for (
          let minutes = scheduleStart;
          minutes + 30 <= scheduleEnd;
          minutes += 30
        ) {
          const slotStart = formatTime(minutes);
          const slotEnd = formatTime(minutes + 30);

          if (addedSlots.has(slotStart)) continue;

          if (date === today) {
            const currentMinutes =
              now.getHours() * 60 + now.getMinutes();

            if (minutes <= currentMinutes) continue;
          }

          addedSlots.add(slotStart);

          generatedSlots.push({
            start: slotStart,
            end: slotEnd,
            bookedCount: bookedCounts.get(slotStart) || 0,
          });
        }
      }

      generatedSlots.sort((a, b) =>
        a.start.localeCompare(b.start)
      );

      setAvailableSlots(generatedSlots);
    } catch (error) {
      console.error('Slot loading error:', error);
      showMessage('Unable to load available time slots.', 'error');
      setAvailableSlots([]);
    } finally {
      setSlotLoading(false);
    }
  };

  const handleDoctorSelect = (doctor: Doctor) => {
    const modes = supportedModes(doctor);

    setSelectedDoctor(doctor);
    setSelectedDate('');
    setSelectedSlot(null);
    setAvailableSlots([]);
    setConsultationMode(modes[0] || '');
    setReason('');
    setMessage('');
  };

  const handleDateChange = async (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setAvailableSlots([]);

    if (!selectedDoctor || !date) return;

    if (date < today) {
      showMessage('Please select today or a future date.', 'error');
      return;
    }

    await loadAvailableSlots(selectedDoctor, date);
  };

  const handleBooking = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (
      !selectedDoctor ||
      !selectedDate ||
      !selectedSlot ||
      !consultationMode
    ) {
      showMessage(
        'Please select consultation mode, date and time slot.',
        'error'
      );
      return;
    }

    if (!supportedModes(selectedDoctor).includes(consultationMode)) {
      showMessage(
        'This doctor does not offer the selected consultation mode.',
        'error'
      );
      return;
    }

    setBooking(true);
    setMessage('');

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) throw userError;

      const user = userData.user;

      if (!user) {
        throw new Error('Please log in to book an appointment.');
      }

      // Refresh the selected slot's count before submitting.
      const { data: latestCounts, error: countError } =
        await supabase.rpc('get_doctor_slot_counts', {
          p_doctor_id: selectedDoctor.id,
          p_appointment_date: selectedDate,
        });

      if (countError) throw countError;

      const currentSlot = ((latestCounts || []) as SlotCount[]).find(
        (item) =>
          item.slot_start.slice(0, 5) === selectedSlot.start
      );

      const currentCount = Number(currentSlot?.booked_count || 0);

      if (currentCount >= SLOT_CAPACITY) {
        setSelectedSlot(null);
        await loadAvailableSlots(selectedDoctor, selectedDate);

        throw new Error(
          'This slot is full. Please select another available slot.'
        );
      }

      const { error } = await supabase
        .from('appointments')
        .insert({
          patient_id: user.id,
          doctor_id: selectedDoctor.id,
          appointment_date: selectedDate,
          start_time: selectedSlot.start,
          end_time: selectedSlot.end,
          consultation_mode: consultationMode,
          reason: reason.trim() || null,
          status: 'pending',
        });

      if (error) {
        if (
          error.message.toLowerCase().includes('slot is full') ||
          error.message.toLowerCase().includes('capacity')
        ) {
          throw new Error(
            'This slot is full. Please select another available slot.'
          );
        }

        throw error;
      }

      showMessage(
        `${consultationMode} appointment request submitted successfully!`,
        'success'
      );

      setSelectedSlot(null);
      setReason('');

      await loadAppointments();
      await loadAvailableSlots(selectedDoctor, selectedDate);
    } catch (error) {
      console.error('Booking error:', error);

      showMessage(
        error instanceof Error
          ? error.message
          : 'Unable to book appointment.',
        'error'
      );
    } finally {
      setBooking(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to cancel this appointment?'
    );

    if (!confirmed) return;

    setCancellingId(appointmentId);
    setMessage('');

    try {
      const { error } = await supabase.rpc(
        'patient_cancel_appointment',
        {
          p_appointment_id: appointmentId,
        }
      );

      if (error) throw error;

      showMessage('Appointment cancelled successfully.', 'success');

      await loadAppointments();

      if (selectedDoctor && selectedDate) {
        await loadAvailableSlots(selectedDoctor, selectedDate);
      }
    } catch (error) {
      console.error('Cancellation error:', error);

      showMessage(
        error instanceof Error
          ? error.message
          : 'Unable to cancel appointment.',
        'error'
      );
    } finally {
      setCancellingId(null);
    }
  };

  const filteredDoctors = doctors.filter((doctor) => {
    const searchText = search.toLowerCase();

    return (
      doctor.full_name.toLowerCase().includes(searchText) ||
      doctor.department.toLowerCase().includes(searchText) ||
      (doctor.hospital_name || '').toLowerCase().includes(searchText)
    );
  });

  if (loading) {
    return (
      <div className="yd-appointments-loading">
        <Loader2 className="spin" size={35} />
        <p>Loading appointments...</p>
      </div>
    );
  }

  return (
    <div className="yd-appointments">
      <div className="yd-appointments-heading">
        <div>
          <span className="yd-appointments-eyebrow">
            BAVYESH'S YDHYA
          </span>
          <h1>Appointments</h1>
          <p>Find doctors and book your consultation.</p>
        </div>
        <CalendarDays size={38} />
      </div>

      {message && (
        <div className={`yd-appointment-message ${messageType}`}>
          {messageType === 'success' ? (
            <CheckCircle size={19} />
          ) : (
            <XCircle size={19} />
          )}
          <span>{message}</span>
        </div>
      )}

      {/* DOCTOR DIRECTORY */}
      <section className="yd-appointment-section">
        <div className="yd-appointment-section-heading">
          <div>
            <h2>
              <Stethoscope size={21} />
              Find a Doctor
            </h2>
            <p>Select a verified doctor to book an appointment.</p>
          </div>

          <div className="yd-doctor-search">
            <Search size={17} />
            <input
              type="text"
              placeholder="Search doctors..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {filteredDoctors.length === 0 ? (
          <div className="yd-appointment-empty">
            <Stethoscope size={30} />
            <p>No approved doctors found.</p>
          </div>
        ) : (
          <div className="yd-booking-doctor-grid">
            {filteredDoctors.map((doctor) => {
              const modes = supportedModes(doctor);

              return (
                <div
                  key={doctor.id}
                  className={`yd-booking-doctor-card ${
                    selectedDoctor?.id === doctor.id ? 'selected' : ''
                  }`}
                >
                  <div className="yd-booking-doctor-top">
                    {doctor.profile_image_url ? (
                      <img
                        src={doctor.profile_image_url}
                        alt={doctor.full_name}
                      />
                    ) : (
                      <div className="yd-booking-doctor-avatar">
                        <User size={25} />
                      </div>
                    )}

                    <div>
                      <h3>{doctor.full_name}</h3>
                      <p>{doctor.department}</p>
                    </div>
                  </div>

                  {doctor.qualification && (
                    <p className="yd-booking-qualification">
                      {doctor.qualification}
                    </p>
                  )}

                  <div className="yd-booking-doctor-detail">
                    <Clock size={15} />
                    {doctor.experience_years || 0} years experience
                  </div>

                  {doctor.hospital_name && (
                    <div className="yd-booking-doctor-detail">
                      <MapPin size={15} />
                      {doctor.hospital_name}
                    </div>
                  )}

                  {doctor.consultation_fee != null && (
                    <div className="yd-booking-doctor-detail">
                      Consultation fee: ₹{doctor.consultation_fee}
                    </div>
                  )}

                  <div className="yd-doctor-mode-list">
                    {modes.map((mode) => (
                      <span key={mode} className="yd-mode-tag">
                        {mode === 'Online' ? (
                          <Video size={13} />
                        ) : (
                          <Hospital size={13} />
                        )}
                        {mode}
                      </span>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="yd-select-doctor"
                    onClick={() => handleDoctorSelect(doctor)}
                    disabled={modes.length === 0}
                  >
                    {selectedDoctor?.id === doctor.id
                      ? 'Selected'
                      : 'Book Appointment'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* BOOKING FORM */}
      {selectedDoctor && (
        <section className="yd-appointment-section yd-booking-form-section">
          <div className="yd-appointment-section-heading">
            <div>
              <h2>
                <CalendarDays size={21} />
                Book Your Appointment
              </h2>
              <p>
                Selected doctor:{' '}
                <strong>{selectedDoctor.full_name}</strong>
              </p>
            </div>
          </div>

          <form className="yd-booking-form" onSubmit={handleBooking}>
            {/* CONSULTATION MODE */}
            <div className="yd-consultation-mode-field">
              <label>Choose Consultation Mode</label>

              <div className="yd-consultation-mode-grid">
                {supportedModes(selectedDoctor).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`yd-consultation-mode-card ${
                      consultationMode === mode ? 'selected' : ''
                    }`}
                    onClick={() => setConsultationMode(mode)}
                  >
                    {mode === 'Online' ? (
                      <Video size={25} />
                    ) : (
                      <Hospital size={25} />
                    )}

                    <strong>
                      {mode === 'Online'
                        ? 'Online Consultation'
                        : 'In-person Visit'}
                    </strong>

                    <span>
                      {mode === 'Online'
                        ? 'Consult through video call'
                        : 'Visit the doctor at the clinic'}
                    </span>

                    {consultationMode === mode && (
                      <CheckCircle size={17} />
                    )}
                  </button>
                ))}
              </div>

              {consultationMode === 'In-person' && (
                <div className="yd-consultation-location">
                  <MapPin size={17} />
                  <div>
                    <strong>Clinic / Hospital</strong>
                    <p>
                      {selectedDoctor.hospital_name ||
                        'Hospital details not yet provided'}
                      {selectedDoctor.city
                        ? `, ${selectedDoctor.city}`
                        : ''}
                      {selectedDoctor.state
                        ? `, ${selectedDoctor.state}`
                        : ''}
                    </p>
                    {!selectedDoctor.hospital_name && (
                      <small>
                        Contact the doctor to confirm the clinic location
                        before visiting.
                      </small>
                    )}
                  </div>
                </div>
              )}

              {consultationMode === 'Online' && (
                <div className="yd-consultation-location">
                  <Video size={17} />
                  <div>
                    <strong>Online Video Consultation</strong>
                    <p>
                      Meeting details will be provided separately after
                      the appointment is confirmed.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <label>
              Select Appointment Date
              <input
                type="date"
                value={selectedDate}
                min={today}
                onChange={(event) =>
                  handleDateChange(event.target.value)
                }
                required
              />
            </label>

            <div className="yd-booking-reason">
              <label>Available 30-Minute Time Slots</label>

              {slotLoading ? (
                <div className="yd-appointment-empty">
                  <Loader2 className="spin" size={24} />
                  <p>Checking available slots...</p>
                </div>
              ) : !selectedDate ? (
                <div className="yd-appointment-empty">
                  <CalendarDays size={25} />
                  <p>Select a date to view available slots.</p>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="yd-appointment-empty">
                  <Clock size={25} />
                  <p>No available 30-minute slots for this date.</p>
                </div>
              ) : (
                <>
                  <div className="yd-slot-grid">
                    {availableSlots.map((slot) => {
                      const isFull =
                        slot.bookedCount >= SLOT_CAPACITY;

                      return (
                        <button
                          key={`${slot.start}-${slot.end}`}
                          type="button"
                          disabled={isFull}
                          className={`yd-slot-button ${
                            selectedSlot?.start === slot.start
                              ? 'selected'
                              : ''
                          } ${isFull ? 'full' : ''}`}
                          onClick={() => setSelectedSlot(slot)}
                        >
                          <strong>
                            {formatDisplayTime(slot.start)}
                          </strong>

                          <small>
                            {isFull
                              ? 'FULL · 10/10'
                              : `${slot.bookedCount}/10 booked · ${
                                  SLOT_CAPACITY - slot.bookedCount
                                } available`}
                          </small>
                        </button>
                      );
                    })}
                  </div>

                  <p className="yd-slot-capacity-note">
                    Each 30-minute slot accepts a maximum of 10 patients.
                  </p>
                </>
              )}

              {selectedSlot && (
                <p>
                  Selected: {formatDisplayTime(selectedSlot.start)}
                  {' – '}
                  {formatDisplayTime(selectedSlot.end)}
                </p>
              )}
            </div>

            <label className="yd-booking-reason">
              Appointment Reason
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Briefly describe the reason for your visit..."
                rows={3}
              />
            </label>

            <div className="yd-booking-actions">
              <button
                type="button"
                className="yd-booking-cancel"
                onClick={() => {
                  setSelectedDoctor(null);
                  setSelectedDate('');
                  setSelectedSlot(null);
                  setConsultationMode('');
                  setAvailableSlots([]);
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="yd-booking-submit"
                disabled={
                  booking ||
                  slotLoading ||
                  !selectedSlot ||
                  !selectedDate ||
                  !consultationMode
                }
              >
                {booking ? (
                  <>
                    <Loader2 className="spin" size={17} />
                    Booking...
                  </>
                ) : (
                  'Book Appointment'
                )}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* MY APPOINTMENTS */}
      <section className="yd-appointment-section">
        <div className="yd-appointment-section-heading">
          <div>
            <h2>
              <CalendarDays size={21} />
              My Appointments
            </h2>
            <p>View and manage your appointment requests.</p>
          </div>
        </div>

        {appointments.length === 0 ? (
          <div className="yd-appointment-empty">
            <CalendarDays size={30} />
            <p>You haven't booked any appointments yet.</p>
          </div>
        ) : (
          <div className="yd-appointment-list">
            {appointments.map((appointment) => {
              const doctor = doctors.find(
                (item) => item.id === appointment.doctor_id
              );

              return (
                <div
                  key={appointment.id}
                  className="yd-appointment-list-card"
                >
                  <div>
                    <strong>
                      {doctor?.full_name || 'Doctor'}
                    </strong>

                    <p>{doctor?.department || 'Consultation'}</p>

                    <small>
                      Date: {appointment.appointment_date}
                    </small>

                    <small>
                      Time: {formatDisplayTime(appointment.start_time)}
                      {' – '}
                      {formatDisplayTime(appointment.end_time)}
                    </small>

                    <small className="yd-appointment-mode">
                      {appointment.consultation_mode === 'Online' ? (
                        <Video size={14} />
                      ) : (
                        <Hospital size={14} />
                      )}
                      Consultation:{' '}
                      {appointment.consultation_mode || 'Not specified'}
                    </small>

                    {appointment.consultation_mode === 'In-person' && (
                      <small>
                        Location:{' '}
                        {doctor?.hospital_name ||
                          'Contact doctor for location'}
                        {doctor?.city ? `, ${doctor.city}` : ''}
                      </small>
                    )}

                    {appointment.reason && (
                      <small>Reason: {appointment.reason}</small>
                    )}

                    {appointment.status === 'pending' && (
                      <button
                        type="button"
                        className="yd-booking-cancel"
                        disabled={cancellingId === appointment.id}
                        onClick={() =>
                          handleCancelAppointment(appointment.id)
                        }
                      >
                        {cancellingId === appointment.id
                          ? 'Cancelling...'
                          : 'Cancel Appointment'}
                      </button>
                    )}
                  </div>

                  <span
                    className={`yd-appointment-status ${appointment.status}`}
                  >
                    {appointment.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default Appointments;
