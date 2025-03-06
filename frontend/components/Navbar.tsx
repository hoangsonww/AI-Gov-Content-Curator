import { MdArticle } from 'react-icons/md'
import ThemeToggle from './ThemeToggle'
import React from 'react'

const ArticleIcon = MdArticle as React.FC<{ size?: number }>

interface NavbarProps {
    theme: 'light' | 'dark' | 'system'
    onThemeChange: (t: 'light' | 'dark' | 'system') => void
}

export default function Navbar({ theme, onThemeChange }: NavbarProps) {
    return (
        <nav className="navbar hover-animate">
            <div className="navbar-left">
                <div className="navbar-title">
                    <ArticleIcon size={24} />
                    <span>Article Curator</span>
                </div>
            </div>
            <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
        </nav>
    )
}
