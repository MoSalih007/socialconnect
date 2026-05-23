import { useState } from 'react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';

const REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'violence', label: 'Violence' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'false_information', label: 'False information' },
  { value: 'other', label: 'Other' },
];

export function ReportModal({ isOpen, onClose, reportData }: any) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.submitReport({ ...reportData, reason, description });
      toast.success('Report submitted successfully');
      onClose();
    } catch {
      toast.error('Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Report Content">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="section-label mb-2 block">Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-neon-cyan/30 transition-all appearance-none"
            required
          >
            <option value="">Select a reason</option>
            {REASONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="section-label mb-2 block">Additional details (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={4}
            className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-neon-cyan/30 resize-none transition-all"
            placeholder="Describe the issue..."
          />
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" isLoading={isSubmitting} className="flex-1">Submit Report</Button>
        </div>
      </form>
    </Modal>
  );
}