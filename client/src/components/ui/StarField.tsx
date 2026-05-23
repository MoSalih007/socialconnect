/**
 * Premium aurora gradient background effect.
 * Smooth, slowly moving gradient blurs inspired by Linear, Stripe, and Vercel.
 * Used on Login and Register pages.
 */
export function StarField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Primary aurora — large cyan sweep */}
      <div
        className="absolute w-[800px] h-[800px] rounded-full opacity-30"
        style={{
          top: '-20%',
          left: '-10%',
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.4) 0%, transparent 70%)',
          filter: 'blur(80px)',
          animation: 'auroraFloat1 18s ease-in-out infinite alternate',
        }}
      />

      {/* Secondary aurora — emerald glow */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-25"
        style={{
          bottom: '-15%',
          right: '-5%',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.35) 0%, transparent 70%)',
          filter: 'blur(80px)',
          animation: 'auroraFloat2 22s ease-in-out infinite alternate',
        }}
      />

      {/* Accent — subtle purple undertone */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full opacity-20"
        style={{
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%)',
          filter: 'blur(100px)',
          animation: 'auroraFloat3 25s ease-in-out infinite alternate',
        }}
      />

      {/* Warm accent — deep teal streak */}
      <div
        className="absolute w-[700px] h-[300px] rounded-full opacity-15"
        style={{
          top: '60%',
          left: '20%',
          background: 'radial-gradient(ellipse, rgba(20, 184, 166, 0.3) 0%, transparent 70%)',
          filter: 'blur(60px)',
          animation: 'auroraFloat4 20s ease-in-out infinite alternate',
        }}
      />

      {/* Subtle noise grain overlay for depth */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '128px 128px',
        }}
      />

      {/* Soft horizontal light streak — adds dimensionality */}
      <div
        className="absolute w-full h-px opacity-10"
        style={{
          top: '35%',
          background: 'linear-gradient(90deg, transparent 5%, rgba(6, 182, 212, 0.5) 30%, rgba(16, 185, 129, 0.4) 50%, rgba(139, 92, 246, 0.3) 70%, transparent 95%)',
          filter: 'blur(1px)',
          animation: 'auroraStreak 15s ease-in-out infinite alternate',
        }}
      />
    </div>
  );
}
