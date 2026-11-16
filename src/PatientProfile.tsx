
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  Loader2,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
  Camera,
  Mail,
  Droplet,
  Edit3,
  RefreshCw,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import './PatientProfile.css'

type Profile = {
  full_name: string
  phone: string
  date_of_birth: string
  gender: string
  blood_group: string
  emergency_contact_name: string
  emergency_contact_phone: string
  allergies: string
  medical_conditions: string
  medical_history: string
  address: string
  avatar_url: string
  account_status: string
}

const emptyProfile: Profile = {
  full_name: '',
  phone: '',
  date_of_birth: '',
  gender: '',
  blood_group: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  allergies: '',
  medical_conditions: '',
  medical_history: '',
  address: '',
  avatar_url: '',
  account_status: 'active',
}

function calculateAge(date: string): number | null {
  if (!date) return null

  const birth = new Date(`${date}T00:00:00`)

  if (Number.isNaN(birth.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()

  const birthdayNotReached =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() &&
      today.getDate() < birth.getDate())

  if (birthdayNotReached) age--

  return age >= 0 ? age : null
}

function PatientProfile() {
  const [profile, setProfile] = useState<Profile>(emptyProfile)
  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fileInput = useRef<HTMLInputElement>(null)

  const age = calculateAge(profile.date_of_birth)

  const initials = profile.full_name.trim()
    ? profile.full_name.trim().charAt(0).toUpperCase()
    : 'P'

  const loadProfile = async () => {
    setLoading(true)
    setError('')

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser()

      if (authError || !auth.user) {
        setError('Please sign in again to view your profile.')
        return
      }

      const user = auth.user

      setUserId(user.id)
      setEmail(user.email || '')

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select(`
          full_name,
          phone,
          date_of_birth,
          gender,
          blood_group,
          emergency_contact_name,
          emergency_contact_phone,
          allergies,
          medical_conditions,
          medical_history,
          address,
          avatar_url,
          account_status
        `)
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        console.error(profileError)
        setError('Unable to load your profile.')
        return
      }

      const loaded: Profile = {
        ...emptyProfile,
        ...(data || {}),
        full_name:
          data?.full_name ||
          user.user_metadata?.full_name ||
          user.email?.split('@')[0] ||
          '',
      }

      setProfile(loaded)

      if (loaded.avatar_url) {
        const { data: signed, error: photoError } =
          await supabase.storage
            .from('patient-photos')
            .createSignedUrl(loaded.avatar_url, 3600)

        if (!photoError && signed?.signedUrl) {
          setPhotoUrl(signed.signedUrl)
        } else {
          console.error('Photo URL error:', photoError)
          setPhotoUrl('')
        }
      } else {
        setPhotoUrl('')
      }
    } catch (err) {
      console.error(err)
      setError('An unexpected error occurred while loading your profile.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProfile()
  }, [])

  const updateField = (field: keyof Profile, value: string) => {
    setProfile(previous => ({
      ...previous,
      [field]: value,
    }))

    setSuccess('')
    setError('')
  }

  const handlePhoto = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Please choose an image smaller than 5 MB.')
      return
    }

    if (!userId) {
      setError('Please sign in again before uploading a photo.')
      return
    }

    setUploading(true)
    setError('')
    setSuccess('')

    try {
      const extension =
        file.name.split('.').pop()?.toLowerCase() || 'jpg'

      const path = `${userId}/avatar.${extension}`

      const { error: uploadError } = await supabase.storage
        .from('patient-photos')
        .upload(path, file, {
          upsert: true,
          contentType: file.type,
        })

      if (uploadError) {
        console.error(uploadError)
        setError(uploadError.message)
        return
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: path })
        .eq('id', userId)

      if (updateError) {
        console.error(updateError)
        setError('Photo uploaded, but the profile could not be updated.')
        return
      }

      setProfile(previous => ({
        ...previous,
        avatar_url: path,
      }))

      const { data: signed, error: signedError } =
        await supabase.storage
          .from('patient-photos')
          .createSignedUrl(path, 3600)

      if (signedError || !signed?.signedUrl) {
        setPhotoUrl('')
        setError('Photo saved. Refresh the profile to display it.')
      } else {
        setPhotoUrl(signed.signedUrl)
        setSuccess('Profile photo updated successfully.')
      }
    } catch (err) {
      console.error(err)
      setError('An unexpected error occurred while uploading your photo.')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser()

      if (authError || !auth.user) {
        setError('Your session has expired. Please sign in again.')
        return
      }

      const { error: saveError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: auth.user.id,
            full_name: profile.full_name,
            phone: profile.phone,
            date_of_birth: profile.date_of_birth || null,
            gender: profile.gender,
            blood_group: profile.blood_group,
            emergency_contact_name: profile.emergency_contact_name,
            emergency_contact_phone: profile.emergency_contact_phone,
            allergies: profile.allergies,
            medical_conditions: profile.medical_conditions,
            medical_history: profile.medical_history,
            address: profile.address,
            avatar_url: profile.avatar_url,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )

      if (saveError) {
        console.error(saveError)
        setError(saveError.message)
        return
      }

      setSuccess('Patient profile saved successfully.')
      setEditing(false)
    } catch (err) {
      console.error(err)
      setError('An unexpected error occurred while saving your profile.')
    } finally {
      setSaving(false)
    }
  }

  const field = (
    label: string,
    key: keyof Profile,
    placeholder: string,
    multiline = false
  ) => (
    <label className="patient-profile-field">
      <span>{label}</span>

      {multiline ? (
        <textarea
          rows={3}
          value={profile[key]}
          disabled={!editing}
          placeholder={placeholder}
          onChange={event => updateField(key, event.target.value)}
        />
      ) : (
        <input
          value={profile[key]}
          disabled={!editing}
          placeholder={placeholder}
          onChange={event => updateField(key, event.target.value)}
        />
      )}
    </label>
  )

  if (loading) {
    return (
      <div className="patient-profile-loading">
        <Loader2 className="profile-spinner" size={34} />
        <h2>Loading patient profile...</h2>
        <p>Preparing your YDHYA health dashboard.</p>
      </div>
    )
  }

  return (
    <div className="patient-profile-page">
      <div className="patient-profile-container">

        <div className="patient-profile-heading">
          <div>
            <span className="patient-profile-eyebrow">
              <HeartPulse size={15} />
              YDHYA PATIENT CENTER
            </span>

            <h1>My Health Profile</h1>
            <p>Your personal identity and health information.</p>
          </div>

          <button
            type="button"
            className="patient-profile-refresh"
            onClick={() => void loadProfile()}
          >
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="patient-profile-message error">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {success && (
          <div className="patient-profile-message success">
            <CheckCircle2 size={18} />
            {success}
          </div>
        )}

        <section className="patient-profile-identity">
          <div className="patient-profile-identity-main">

            <div className="patient-profile-photo-wrap">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Patient profile"
                  className="patient-profile-photo"
                />
              ) : (
                <div className="patient-profile-photo-placeholder">
                  {initials}
                </div>
              )}

              <button
                type="button"
                className="patient-profile-camera"
                aria-label="Upload profile photo"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="profile-spinner" size={17} />
                ) : (
                  <Camera size={17} />
                )}
              </button>

              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                hidden
                onChange={handlePhoto}
              />
            </div>

            <div className="patient-profile-identity-info">
              <span className="patient-profile-label">
                PATIENT ACCOUNT
              </span>

              <h2>{profile.full_name || 'Patient name not added'}</h2>

              <p>
                <Mail size={15} />
                {email || 'Email not available'}
              </p>

              <p>
                <ShieldCheck size={15} />
                {profile.account_status || 'Account'}
              </p>

              <button
                type="button"
                className="patient-profile-photo-action"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
              >
                <Camera size={15} />
                {uploading ? 'Uploading photo...' : 'Change profile photo'}
              </button>

              <small>Image files only · Maximum 5 MB</small>
            </div>
          </div>

          <div className="patient-profile-id-card">
            <span>YDHYA PATIENT ID</span>
            <strong>
              {userId ? userId.slice(0, 8).toUpperCase() : '—'}
            </strong>
            <small>Account identifier</small>
          </div>
        </section>

        <section className="patient-profile-stats">

          <div className="patient-profile-stat">
            <span className="patient-profile-stat-icon green">
              <CalendarDays size={21} />
            </span>
            <div>
              <small>AGE</small>
              <strong>
                {age === null ? 'Not added' : `${age} years`}
              </strong>
            </div>
          </div>

          <div className="patient-profile-stat">
            <span className="patient-profile-stat-icon red">
              <Droplet size={21} />
            </span>
            <div>
              <small>BLOOD GROUP</small>
              <strong>{profile.blood_group || 'Not added'}</strong>
            </div>
          </div>

          <div className="patient-profile-stat">
            <span className="patient-profile-stat-icon blue">
              <UserRound size={21} />
            </span>
            <div>
              <small>GENDER</small>
              <strong>{profile.gender || 'Not added'}</strong>
            </div>
          </div>

          <div className="patient-profile-stat">
            <span className="patient-profile-stat-icon purple">
              <Phone size={21} />
            </span>
            <div>
              <small>PHONE</small>
              <strong>{profile.phone || 'Not added'}</strong>
            </div>
          </div>
        </section>

        <form onSubmit={handleSave}>

          <div className="patient-profile-form-heading">
            <div>
              <h2>Patient information</h2>
              <p>Review and update your details below.</p>
            </div>

            {!editing && (
              <button
                type="button"
                className="patient-profile-edit"
                onClick={() => setEditing(true)}
              >
                <Edit3 size={17} />
                Edit profile
              </button>
            )}
          </div>

          <section className="patient-profile-section">
            <div className="patient-profile-section-heading">
              <span className="patient-profile-section-icon green">
                <UserRound size={21} />
              </span>

              <div>
                <h3>Personal details</h3>
                <p>Identity and contact information</p>
              </div>
            </div>

            <div className="patient-profile-grid">
              {field('Full name', 'full_name', 'Patient full name')}
              {field('Phone number', 'phone', 'Phone number')}

              <label className="patient-profile-field">
                <span>Date of birth</span>
                <input
                  type="date"
                  value={profile.date_of_birth}
                  disabled={!editing}
                  onChange={event =>
                    updateField('date_of_birth', event.target.value)
                  }
                />
              </label>

              <label className="patient-profile-field">
                <span>Gender</span>
                <select
                  value={profile.gender}
                  disabled={!editing}
                  onChange={event =>
                    updateField('gender', event.target.value)
                  }
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">
                    Prefer not to say
                  </option>
                </select>
              </label>

              <label className="patient-profile-field">
                <span>Blood group</span>
                <select
                  value={profile.blood_group}
                  disabled={!editing}
                  onChange={event =>
                    updateField('blood_group', event.target.value)
                  }
                >
                  <option value="">Select blood group</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(
                    group => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    )
                  )}
                </select>
              </label>

              {field('Address', 'address', 'Your address')}
            </div>
          </section>

          <section className="patient-profile-section">
            <div className="patient-profile-section-heading">
              <span className="patient-profile-section-icon blue">
                <Phone size={21} />
              </span>

              <div>
                <h3>Emergency contact</h3>
                <p>Contact information for emergencies</p>
              </div>
            </div>

            <div className="patient-profile-grid">
              {field(
                "Contact person's name",
                'emergency_contact_name',
                'Name'
              )}

              {field(
                'Emergency phone',
                'emergency_contact_phone',
                'Phone number'
              )}
            </div>
          </section>

          <section className="patient-profile-section">
            <div className="patient-profile-section-heading">
              <span className="patient-profile-section-icon purple">
                <ClipboardList size={21} />
              </span>

              <div>
                <h3>Medical information</h3>
                <p>Health details provided by you</p>
              </div>
            </div>

            <div className="patient-profile-grid single">
              {field(
                'Known allergies',
                'allergies',
                'Enter known allergies',
                true
              )}

              {field(
                'Medical conditions',
                'medical_conditions',
                'Enter known conditions',
                true
              )}

              {field(
                'Medical history',
                'medical_history',
                'Enter relevant medical history',
                true
              )}
            </div>
          </section>

          {editing && (
            <div className="patient-profile-save-row">
              <button
                type="button"
                className="patient-profile-cancel"
                onClick={() => {
                  setEditing(false)
                  void loadProfile()
                }}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="patient-profile-save"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="profile-spinner" size={18} />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Save changes
                  </>
                )}
              </button>
            </div>
          )}
        </form>

        <div className="patient-profile-privacy">
          <ShieldCheck size={19} />
          <p>
            Your health information is private. Only share it with
            healthcare professionals when needed for your care.
            YDHYA does not replace professional medical advice.
          </p>
        </div>

      </div>
    </div>
  )
}

export default PatientProfile
