'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { samplePulseMetrics } from '@/lib/sample-data';
import { TexasPulseMetric } from '@/lib/types';

export default function TexasPulse() {
  // Duplicate metrics for seamless scrolling
  const displayMetrics = [...samplePulseMetrics, ...samplePulseMetrics];

  const getDeltaColor = (metric: TexasPulseMetric): string => {
    if (metric.deltaDirection === 'neutral') return 'var(--text-secondary)';

    // For enrollment and delta metrics: down is bad (red)
    if (metric.label === 'Enrollment' || metric.label === '12-Mo Delta') {
      return metric.deltaDirection === 'down' ? 'var(--accent-red)' : 'var(--accent-emerald)';
    }

    // For cost metrics: up is bad (red)
    if (metric.label === 'Per Enrollee') {
      return metric.deltaDirection === 'up' ? 'var(--accent-red)' : 'var(--accent-emerald)';
    }

    // For quality/positive metrics: up is good (emerald)
    if (metric.label === 'Quality Score') {
      return metric.deltaDirection === 'up' ? 'var(--accent-emerald)' : 'var(--accent-red)';
    }

    return 'var(--text-secondary)';
  };

  const getDeltaIcon = (metric: TexasPulseMetric) => {
    if (metric.deltaDirection === 'up') {
      return <TrendingUp className="w-3 h-3" />;
    }
    if (metric.deltaDirection === 'down') {
      return <TrendingDown className="w-3 h-3" />;
    }
    return <Minus className="w-3 h-3" />;
  };

  return (
    <div
      className="w-full border-t"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-subtle)',
        borderTopColor: 'var(--texas-primary)',
        boxShadow: '0 4px 12px rgba(249, 115, 22, 0.08)',
        height: '48px',
      }}
    >
      <div className="relative h-full overflow-hidden">
        {/* Gradient overlays for seamless edges */}
        <div
          className="absolute left-0 top-0 bottom-0 w-8 z-10"
          style={{
            backgroundImage: 'linear-gradient(to right, var(--bg-primary), transparent)',
          }}
        />
        <div
          className="absolute right-0 top-0 bottom-0 w-8 z-10"
          style={{
            backgroundImage: 'linear-gradient(to left, var(--bg-primary), transparent)',
          }}
        />

        {/* Scrolling ticker */}
        <div className="ticker-animate flex h-full items-center">
          {displayMetrics.map((metric, idx) => (
            <div
              key={`${metric.label}-${idx}`}
              className="flex items-center px-6 shrink-0"
              style={{
                minWidth: '200px',
              }}
            >
              {/* Metric content */}
              <div className="flex flex-col gap-0.5">
                {/* Label */}
                <div
                  className="text-xs font-medium tracking-wide uppercase"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {metric.label}
                </div>

                {/* Value and delta on same line */}
                <div className="flex items-center gap-2">
                  {/* Value */}
                  <div
                    className="text-sm font-bold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {metric.value}
                  </div>

                  {/* Delta */}
                  {metric.delta && (
                    <div
                      className="flex items-center gap-1 text-xs font-medium"
                      style={{ color: getDeltaColor(metric) }}
                    >
                      {getDeltaIcon(metric)}
                      <span>{metric.delta}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Vertical divider (except for last item in each set) */}
              {idx < samplePulseMetrics.length - 1 || idx >= samplePulseMetrics.length ? (
                <div
                  className="ml-6 w-px h-8"
                  style={{ backgroundColor: 'var(--border-subtle)' }}
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
