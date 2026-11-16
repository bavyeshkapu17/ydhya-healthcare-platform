
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ChangeEvent,
} from 'react';

import {
  FileText,
  Upload,
  Download,
  Eye,
  Trash2,
  Search,
  Plus,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  CalendarDays,
  User,
  Building2,
} from 'lucide-react';

import { supabase } from './lib/supabase';
import './PatientHealthRecords.css';

type RecordCategory =
  | 'Prescription'
  | 'Lab Report'
  | 'Scan Report'
  | 'Discharge Summary'
  | 'Other';

interface HealthRecord {
  id: string;
  user_id: string;
  title: string;
  category: RecordCategory;
  record_date: string | null;
  doctor_name: string | null;
  hospital_name: string | null;
  description: string | null;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

interface RecordForm {
  title: string;
  category: RecordCategory;
  record_date: string;
  doctor_name: string;
  hospital_name: string;
  description: string;
}

const initialForm: RecordForm = {
  title: '',
  category: 'Lab Report',
  record_date: '',
  doctor_name: '',
  hospital_name: '',
  description: '',
};

const categories: RecordCategory[] = [
  'Prescription',
  'Lab Report',
  'Scan Report',
  'Discharge Summary',
  'Other',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const BUCKET_NAME = 'health-records';

export default function PatientHealthRecords() {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RecordForm>(initialForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load patient medical records
  const loadRecords = async () => {
    setLoading(true);
    setError('');

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        throw new Error('Please log in to view your health records.');
      }

      const { data, error: recordsError } = await supabase
        .from('health_records')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (recordsError) throw recordsError;

      setRecords((data ?? []) as HealthRecord[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load health records.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
  }, []);

  // Form input changes
  const handleFormChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // Validate selected document
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError('');
    setSuccess('');

    const file = event.target.files?.[0];

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
    ];

    if (!allowedTypes.includes(file.type)) {
      setError('Only PDF, JPG and PNG files are supported.');
      event.target.value = '';
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('File size must be 10 MB or less.');
      event.target.value = '';
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  // Reset upload form
  const resetForm = () => {
    setForm(initialForm);
    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setShowForm(false);
  };

  // Upload medical document
  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (!form.title.trim()) {
      setError('Please enter a record title.');
      return;
    }

    if (!selectedFile) {
      setError('Please select a medical document to upload.');
      return;
    }

    setUploading(true);

    let uploadedPath: string | null = null;

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        throw new Error('Please log in again before uploading.');
      }

      const safeFileName = selectedFile.name
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(-100);

      const filePath = `${user.id}/${crypto.randomUUID()}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, selectedFile, {
          contentType: selectedFile.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      uploadedPath = filePath;

      const { error: insertError } = await supabase
        .from('health_records')
        .insert({
          user_id: user.id,
          title: form.title.trim(),
          category: form.category,
          record_date: form.record_date || null,
          doctor_name: form.doctor_name.trim() || null,
          hospital_name: form.hospital_name.trim() || null,
          description: form.description.trim() || null,
          file_name: selectedFile.name,
          file_path: filePath,
          file_type: selectedFile.type,
          file_size: selectedFile.size,
        });

      if (insertError) throw insertError;

      resetForm();
      setSuccess('Medical record uploaded successfully.');

      await loadRecords();
    } catch (err) {
      if (uploadedPath) {
        await supabase.storage
          .from(BUCKET_NAME)
          .remove([uploadedPath]);
      }

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to upload your medical record.'
      );
    } finally {
      setUploading(false);
    }
  };

  // Open document
  const openRecord = async (record: HealthRecord) => {
    setError('');

    try {
      const { data, error: urlError } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(record.file_path, 60);

      if (urlError) throw urlError;

      if (!data?.signedUrl) {
        throw new Error('Unable to generate document link.');
      }

      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to open this document.'
      );
    }
  };

  // Download document
  const downloadRecord = async (record: HealthRecord) => {
    setError('');

    try {
      const { data, error: downloadError } = await supabase.storage
        .from(BUCKET_NAME)
        .download(record.file_path);

      if (downloadError) throw downloadError;

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');

      link.href = url;
      link.download = record.file_name;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to download this document.'
      );
    }
  };

  // Delete document
  const deleteRecord = async (record: HealthRecord) => {
    const confirmed = window.confirm(
      `Delete "${record.title}"? This will permanently remove the uploaded document.`
    );

    if (!confirmed) return;

    setDeletingId(record.id);
    setError('');
    setSuccess('');

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user || user.id !== record.user_id) {
        throw new Error('You cannot delete this record.');
      }

      const { error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([record.file_path]);

      if (storageError) throw storageError;

      const { error: deleteError } = await supabase
        .from('health_records')
        .delete()
        .eq('id', record.id)
        .eq('user_id', user.id);

      if (deleteError) {
        throw new Error(
          'The file was removed, but the database record could not be deleted. Please contact support.'
        );
      }

      setRecords((previous) =>
        previous.filter((item) => item.id !== record.id)
      );

      setSuccess('Health record deleted successfully.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete this record.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  // Live dashboard statistics
  const recordStats = [
    {
      label: 'Total Records',
      count: records.length,
    },
    {
      label: 'Prescriptions',
      count: records.filter(
        (record) => record.category === 'Prescription'
      ).length,
    },
    {
      label: 'Lab Reports',
      count: records.filter(
        (record) => record.category === 'Lab Report'
      ).length,
    },
    {
      label: 'Scan Reports',
      count: records.filter(
        (record) => record.category === 'Scan Report'
      ).length,
    },
  ];

  // Search and category filtering
  const filteredRecords = records.filter((record) => {
    const matchesCategory =
      filter === 'All' || record.category === filter;

    const searchText = search.toLowerCase();

    const matchesSearch =
      record.title.toLowerCase().includes(searchText) ||
      record.category.toLowerCase().includes(searchText) ||
      (record.doctor_name ?? '').toLowerCase().includes(searchText) ||
      (record.hospital_name ?? '').toLowerCase().includes(searchText);

    return matchesCategory && matchesSearch;
  });

  const formatDate = (date: string | null) => {
    if (!date) return 'Date not specified';

    return new Date(`${date}T00:00:00`).toLocaleDateString(
      'en-IN',
      {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }
    );
  };

  const formatSize = (size: number | null) => {
    if (size === null || size === undefined) return 'Unknown size';

    return size < 1024 * 1024
      ? `${(size / 1024).toFixed(1)} KB`
      : `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="health-records-page">
      <header className="health-records-header">
        <div>
          <span className="records-eyebrow">
            YOUR HEALTH LIBRARY
          </span>

          <h1>Medical Records</h1>

          <p>
            Keep your prescriptions, reports and medical documents
            organized in one place.
          </p>
        </div>

        <button
          className="records-add-button"
          onClick={() => {
            setShowForm(true);
            setError('');
            setSuccess('');
          }}
          type="button"
        >
          <Plus size={19} />
          Add Record
        </button>
      </header>

      {error && (
        <div className="records-alert records-error" role="alert">
          <AlertCircle size={19} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="records-alert records-success" role="status">
          <CheckCircle size={19} />
          <span>{success}</span>
        </div>
      )}

      {/* Dashboard statistics */}
      <div className="records-stats-grid">
        {recordStats.map((stat, index) => (
          <div
            className={`records-stat-card records-stat-${index}`}
            key={stat.label}
          >
            <div className="records-stat-icon">
              <FileText size={23} />
            </div>

            <div>
              <span>{stat.label}</span>
              <strong>{stat.count}</strong>
            </div>
          </div>
        ))}
      </div>

      {/* Upload form */}
      {showForm && (
        <section className="record-upload-section">
          <div className="record-form-header">
            <div>
              <h2>Upload Medical Record</h2>
              <p>Add document details before uploading.</p>
            </div>

            <button
              type="button"
              className="record-close-button"
              onClick={resetForm}
              disabled={uploading}
              aria-label="Close upload form"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleUpload}>
            <div className="record-form-grid">
              <div className="record-field">
                <label htmlFor="record-title">Record Title *</label>
                <input
                  id="record-title"
                  name="title"
                  value={form.title}
                  onChange={handleFormChange}
                  placeholder="Example: Blood Test Report"
                  required
                />
              </div>

              <div className="record-field">
                <label htmlFor="record-category">Category *</label>
                <select
                  id="record-category"
                  name="category"
                  value={form.category}
                  onChange={handleFormChange}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="record-field">
                <label htmlFor="record-date">Record Date</label>
                <input
                  id="record-date"
                  type="date"
                  name="record_date"
                  value={form.record_date}
                  onChange={handleFormChange}
                />
              </div>

              <div className="record-field">
                <label htmlFor="record-doctor">Doctor Name</label>
                <input
                  id="record-doctor"
                  name="doctor_name"
                  value={form.doctor_name}
                  onChange={handleFormChange}
                  placeholder="Enter doctor name"
                />
              </div>

              <div className="record-field record-field-full">
                <label htmlFor="record-hospital">
                  Hospital / Lab Name
                </label>
                <input
                  id="record-hospital"
                  name="hospital_name"
                  value={form.hospital_name}
                  onChange={handleFormChange}
                  placeholder="Enter hospital or laboratory name"
                />
              </div>

              <div className="record-field record-field-full">
                <label htmlFor="record-description">
                  Description
                </label>
                <textarea
                  id="record-description"
                  name="description"
                  value={form.description}
                  onChange={handleFormChange}
                  placeholder="Add any useful notes about this document"
                  rows={3}
                />
              </div>

              <div className="record-field record-field-full">
                <label htmlFor="record-file">
                  Medical Document *
                </label>

                <div className="record-file-box">
                  <Upload size={25} />

                  <strong>
                    {selectedFile
                      ? selectedFile.name
                      : 'Choose a medical document'}
                  </strong>

                  <span>PDF, JPG or PNG · Maximum 10 MB</span>

                  <input
                    ref={fileInputRef}
                    id="record-file"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    onChange={handleFileChange}
                  />
                </div>
              </div>
            </div>

            <div className="record-form-actions">
              <button
                type="button"
                className="record-cancel-button"
                onClick={resetForm}
                disabled={uploading}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="records-add-button"
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2
                      className="records-spinner"
                      size={18}
                    />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    Upload Record
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Records library */}
      <section className="records-list-section">
        <div className="records-list-heading">
          <div>
            <h2>Your Documents</h2>
            <p>Access your saved medical records.</p>
          </div>

          <button
            type="button"
            className="records-refresh-button"
            onClick={() => void loadRecords()}
            disabled={loading}
            aria-label="Refresh records"
          >
            <RefreshCw size={17} />
          </button>
        </div>

        <div className="records-toolbar">
          <div className="records-search">
            <Search size={18} />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search medical records..."
              aria-label="Search medical records"
            />
          </div>

          <select
            className="records-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            aria-label="Filter records by category"
          >
            <option value="All">All Categories</option>

            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="records-loading">
            <Loader2
              className="records-spinner"
              size={30}
            />
            <p>Loading medical records...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="records-empty">
            <div className="records-empty-icon">
              <FileText size={32} />
            </div>

            <h3>No medical records found</h3>

            <p>
              {records.length === 0
                ? 'Upload your first prescription or medical report to get started.'
                : 'Try changing your search or category filter.'}
            </p>

            {records.length === 0 && (
              <button
                type="button"
                className="records-add-button"
                onClick={() => setShowForm(true)}
              >
                <Plus size={18} />
                Add First Record
              </button>
            )}
          </div>
        ) : (
          <div className="records-grid">
            {filteredRecords.map((record) => (
              <article className="record-card" key={record.id}>
                <div className="record-card-top">
                  <div className="record-file-icon">
                    <FileText size={24} />
                  </div>

                  <span className="record-category">
                    {record.category}
                  </span>
                </div>

                <h3>{record.title}</h3>

                <p className="record-file-name">
                  {record.file_name}
                </p>

                <div className="record-meta">
                  <span>
                    <CalendarDays size={15} />
                    {formatDate(record.record_date)}
                  </span>

                  {record.doctor_name && (
                    <span>
                      <User size={15} />
                      {record.doctor_name}
                    </span>
                  )}

                  {record.hospital_name && (
                    <span>
                      <Building2 size={15} />
                      {record.hospital_name}
                    </span>
                  )}
                </div>

                <div className="record-card-footer">
                  <span>{formatSize(record.file_size)}</span>

                  <div className="record-card-actions">
                    <button
                      type="button"
                      onClick={() => void openRecord(record)}
                      title="View document"
                      aria-label={`View ${record.title}`}
                    >
                      <Eye size={17} />
                    </button>

                    <button
                      type="button"
                      onClick={() => void downloadRecord(record)}
                      title="Download document"
                      aria-label={`Download ${record.title}`}
                    >
                      <Download size={17} />
                    </button>

                    <button
                      type="button"
                      className="record-delete-action"
                      onClick={() => void deleteRecord(record)}
                      disabled={deletingId === record.id}
                      title="Delete document"
                      aria-label={`Delete ${record.title}`}
                    >
                      {deletingId === record.id ? (
                        <Loader2
                          className="records-spinner"
                          size={17}
                        />
                      ) : (
                        <Trash2 size={17} />
                      )}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Privacy information */}
      <div className="records-security-note">
        <ShieldIcon />

        <p>
          Medical documents are stored in a private storage bucket.
          Keep your login credentials secure and only upload documents
          you are authorized to store.
        </p>
      </div>
    </div>
  );
}

function ShieldIcon() {
  return <CheckCircle size={19} aria-hidden="true" />;
}
