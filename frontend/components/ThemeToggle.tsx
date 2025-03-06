import { useState } from 'react'
import React from 'react'
import { MdDarkMode, MdLightMode, MdSettingsBrightness } from 'react-icons/md'

const DarkModeIcon = MdDarkMode as React.FC<{ size?: number }>
const LightModeIcon = MdLightMode as React.FC<{ size?: number }>
const SettingsBrightnessIcon = MdSettingsBrightness as React.FC<{ size?: number }>

interface ThemeToggleProps {
    theme: 'light' | 'dark' | 'system'
    onThemeChange: (t: 'light' | 'dark' | 'system') => void
}

export default function ThemeToggle({ theme, onThemeChange }: ThemeToggleProps) {
    const [open, setOpen] = useState(false)

    const handleSelect = (newTheme: 'light' | 'dark' | 'system') => {
        onThemeChange(newTheme)
        setOpen(false)
    }

    return (
        <div style={{ position: 'relative' }}>
            <button
                className="theme-toggle"
                onClick={() => setOpen(!open)}
                aria-label="Toggle theme"
            >
                {theme === 'light' && <LightModeIcon size={18} />}
                {theme === 'dark' && <DarkModeIcon size={18} />}
                {theme === 'system' && <SettingsBrightnessIcon size={18} />}
            </button>
            {open && (
                <div
                    style={{
                        position: 'absolute',
                        right: 0,
                        top: '2.5rem',
                        backgroundColor: 'var(--card-bg)',
                        border: '1px solid var(--card-border)',
                        borderRadius: 6,
                        padding: '0.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                        zIndex: 999
                    }}
                >
                    <Option
                        label="Light"
                        icon={<LightModeIcon size={16} />}
                        isSelected={theme === 'light'}
                        onClick={() => handleSelect('light')}
                    />
                    <Option
                        label="Dark"
                        icon={<DarkModeIcon size={16} />}
                        isSelected={theme === 'dark'}
                        onClick={() => handleSelect('dark')}
                    />
                    <Option
                        label="System"
                        icon={<SettingsBrightnessIcon size={16} />}
                        isSelected={theme === 'system'}
                        onClick={() => handleSelect('system')}
                    />
                </div>
            )}
        </div>
    )
}

interface OptionProps {
    label: string
    icon: React.ReactNode
    isSelected: boolean
    onClick: () => void
}

function Option({ label, icon, isSelected, onClick }: OptionProps) {
    return (
        <button
            onClick={onClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'none',
                border: 'none',
                padding: '0.3rem 0.5rem',
                cursor: 'pointer',
                width: '100%',
                color: isSelected ? 'var(--accent-color)' : 'inherit'
            }}
        >
            {icon}
            <span>{label}</span>
        </button>
    )
}
