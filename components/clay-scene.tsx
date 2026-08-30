import Image from 'next/image';

export function ClayScene({ module, className = '' }: { module: 'recorder' | 'memory' | 'jury'; className?: string }) {
  const label = module === 'recorder'
    ? 'Original coral clay flight recorder with a looping evidence trail'
    : module === 'memory'
      ? 'Original lavender and mint clay branches converging into a resolved memory crystal'
      : 'Original deep-teal and ochre clay research jury with source evidence';
  const source = module === 'recorder' ? '/module-flight-recorder.png' : module === 'memory' ? '/module-memory-merge.png' : '/module-research-jury.png';
  return <div role="img" aria-label={label} className={`aspect-[4/3] overflow-hidden bg-[#f7f0e4] ${className}`}><Image src={source} alt="" aria-hidden="true" width={1024} height={768} unoptimized className="h-full w-full object-cover" /></div>;
}
