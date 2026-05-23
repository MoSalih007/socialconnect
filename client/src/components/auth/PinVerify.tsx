import { useState } from 'react';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import { motion } from 'framer-motion';

interface PinVerifyProps {
  fingerprint: string;
  onSuccess: () => void;
}

export function PinVerify({ fingerprint, onSuccess }: PinVerifyProps) {
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const MAX_ATTEMPTS = 5;
  const isLocked = attempts >= MAX_ATTEMPTS;

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);
    if (value && index < 5) document.getElementById(`verify-pin-${index + 1}`)?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !(e.target as HTMLInputElement).value && index > 0) {
      document.getElementById(`verify-pin-${index - 1}`)?.focus();
    }
  };

  const handleSubmit = async () => {
    const pinValue = pin.join('');
    if (pinValue.length !== 6) { setError('Please enter your 6-digit PIN'); return; }
    setIsLoading(true); setError('');
    try { await api.verifyDevicePin(fingerprint, pinValue); onSuccess(); }
    catch {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= MAX_ATTEMPTS) {
        setError('Too many failed attempts. Your account is locked for 15 minutes.');
      } else {
        setError(`Incorrect PIN. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts !== 1 ? 's' : ''} remaining.`);
      }
      setPin(['', '', '', '', '', '']);
      setTimeout(() => document.getElementById('verify-pin-0')?.focus(), 50);
    } finally { setIsLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass p-8 shadow-card-glow relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #00FFD1, transparent)' }} />

        <div className="text-center mb-8">
          <div className="text-6xl mb-4">{isLocked ? '🔒' : '🛡️'}</div>
          <h2 className="text-2xl font-bold text-white mb-2">Verify This Device</h2>
          <p className="text-gray-400 text-sm">Enter your 6-digit PIN to continue</p>
        </div>

        <div className="flex gap-3 justify-center mb-6">
          {pin.map((digit, index) => (
            <input
              key={index}
              id={`verify-pin-${index}`}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handlePinChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              disabled={isLocked}
              className="w-12 h-14 text-center text-2xl font-bold border-2 border-white/10 rounded-xl focus:border-neon-cyan focus:outline-none bg-black/40 text-white transition-all focus:shadow-neon-sm disabled:opacity-50 disabled:cursor-not-allowed"
              autoFocus={index === 0}
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {attempts > 0 && !isLocked && (
          <div className="mb-4 text-center">
            <div className="flex gap-2 justify-center mb-1">
              {[...Array(MAX_ATTEMPTS)].map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i < attempts ? 'bg-red-500' : 'bg-white/10'}`} />
              ))}
            </div>
          </div>
        )}

        {!isLocked && (
          <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-4 mb-6">
            <p className="text-sm text-yellow-400/80">
              <strong>⚠️ New device detected</strong><br />
              For your security, please verify your identity with your PIN.
            </p>
          </div>
        )}

        <Button onClick={handleSubmit} className="w-full" isLoading={isLoading} disabled={pin.join('').length !== 6 || isLocked}>
          {isLocked ? 'Account Locked' : 'Verify Device'}
        </Button>
      </motion.div>
    </div>
  );
}