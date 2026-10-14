import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			// Broadsheet-Rampen direkt nutzbar, z. B. text-ds-neutral-700, bg-ds-accent-700
  			ds: {
  				bg: 'var(--color-bg)',
  				surface: 'var(--color-surface)',
  				text: 'var(--color-text)',
  				divider: 'var(--color-divider)',
  				neutral: { '100': 'var(--color-neutral-100)', '200': 'var(--color-neutral-200)', '300': 'var(--color-neutral-300)', '400': 'var(--color-neutral-400)', '500': 'var(--color-neutral-500)', '600': 'var(--color-neutral-600)', '700': 'var(--color-neutral-700)', '800': 'var(--color-neutral-800)', '900': 'var(--color-neutral-900)' },
  				accent: { DEFAULT: 'var(--color-accent)', ...{ '100': 'var(--color-accent-100)', '200': 'var(--color-accent-200)', '300': 'var(--color-accent-300)', '400': 'var(--color-accent-400)', '500': 'var(--color-accent-500)', '600': 'var(--color-accent-600)', '700': 'var(--color-accent-700)', '800': 'var(--color-accent-800)', '900': 'var(--color-accent-900)' } },
  				'accent-2': { DEFAULT: 'var(--color-accent-2)', ...{ '100': 'var(--color-accent-2-100)', '200': 'var(--color-accent-2-200)', '300': 'var(--color-accent-2-300)', '400': 'var(--color-accent-2-400)', '500': 'var(--color-accent-2-500)', '600': 'var(--color-accent-2-600)', '700': 'var(--color-accent-2-700)', '800': 'var(--color-accent-2-800)', '900': 'var(--color-accent-2-900)' } }
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 3px)'
  		},
  		fontFamily: {
  			sans: ['var(--font-source-serif)', 'Georgia', 'serif'],
  			serif: ['var(--font-source-serif)', 'Georgia', 'serif']
  		},
  		boxShadow: {
  			sm: 'var(--shadow-sm)',
  			md: 'var(--shadow-md)',
  			lg: 'var(--shadow-lg)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [animate],
};
export default config;
