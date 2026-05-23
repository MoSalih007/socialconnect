import { useState } from 'react';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import { motion } from 'framer-motion';

interface PinSetupProps {
  fingerprint: string;
  onComplete: () => void;
}

export function PinSetup({ fingerprint, onComplete }: PinSetupProps) {
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handlePinChange = (index: number, value: string, isConfirm = false) => {
    if (!/^\d*$/.test(value)) return;
    const newPin = isConfirm ? [...confirmPin] : [...pin];
    newPin[index] = value.slice(-1);
    isConfirm ? setConfirmPin(newPin) : setPin(newPin);
    if (value && index < 5) {
      document.getElementById(`pin-${isConfirm ? 'confirm-' : ''}${index + 1}`)?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number, isConfirm = false) => {
    if (e.key === 'Backspace' && !(e.target as HTMLInputElement).value && index > 0) {
      document.getElementById(`pin-${isConfirm ? 'confirm-' : ''}${index - 1}`)?.focus();
    }
  };

  const handleContinue = () => {
    if (pin.join('').length !== 6) { setError('Please enter all 6 digits'); return; }
    setError(''); setStep('confirm');
  };

  const handleSubmit = async () => {
    const pinValue = pin.join('');
    const confirmValue = confirmPin.join('');
    if (pinValue !== confirmValue) {
      setError('PINs do not match. Please try again.');
      setConfirmPin(['', '', '', '', '', '']);
      document.getElementById('pin-confirm-0')?.focus();
      return;
    }
    setIsLoading(true); setError('');
    try { await api.setupDevicePin(fingerprint, pinValue); onComplete(); }
    catch (err: any) { setError(err.message || 'Failed to set up PIN.'); }
    finally { setIsLoading(false); }
  };

  const handleBack = () => { setStep('create'); setConfirmPin(['', '', '', '', '', '']); setError(''); };

  const currentPin = step === 'create' ? pin : confirmPin;
  const isConfirmStep = step === 'confirm';

  return (
    <div className="max-w-md mx-auto w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass p-8 shadow-card-glow relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #00FFD1, transparent)' }} />

        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {isConfirmStep ? 'Confirm Your PIN' : 'Create Your PIN'}
          </h2>
          <p className="text-gray-400 text-sm">
            {isConfirmStep ? 'Re-enter your PIN to confirm it' : 'Create a 6-digit PIN to secure this device'}
          </p>
        </div>

        <div className="flex gap-3 justify-center mb-6">
          {currentPin.map((digit, index) => (
            <input
              key={index}
              id={`pin-${isConfirmStep ? 'confirm-' : ''}${index}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handlePinChange(index, e.target.value, isConfirmStep)}
              onKeyDown={(e) => handleKeyDown(e, index, isConfirmStep)}
              className="w-12 h-14 text-center text-2xl font-bold border-2 border-white/10 rounded-xl focus:border-neon-cyan focus:outline-none bg-black/40 text-white transition-all focus:shadow-neon-sm"
              autoFocus={index === 0}
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <div className="bg-neon-cyan/5 border border-neon-cyan/10 rounded-xl p-4 mb-6">
          <p className="text-sm text-neon-cyan/80">
            <strong>💡 Tip:</strong> Choose a PIN you'll remember. You'll need it when logging in from new devices.
          </p>
        </div>

        <div className="space-y-3">
          {!isConfirmStep ? (
            <Button onClick={handleContinue} className="w-full" disabled={pin.join('').length !== 6}>
              Continue
            </Button>
          ) : (
            <>
              <Button onClick={handleSubmit} className="w-full" isLoading={isLoading} disabled={confirmPin.join('').length !== 6}>
                Confirm PIN
              </Button>
              <button onClick={handleBack} className="w-full py-2 text-sm text-gray-400 hover:text-white transition-colors">
                ← Back
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}