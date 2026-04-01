'use client';

interface StepLayoutProps {
  children: React.ReactNode;
  dark?: boolean;
}

export default function StepLayout({ children, dark = false }: StepLayoutProps) {
  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 ${dark ? 'bg-[#0a0a0a]' : 'bg-white'}`}>
      <div className={`w-full max-w-sm`}>
        {children}
      </div>
    </div>
  );
}
