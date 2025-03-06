import React from 'react'
import {MdCopyright} from 'react-icons/md'

interface CopyrightIconProps {
    style?: { marginRight: string }
}

const CopyrightIcon = MdCopyright as React.FC<{ size?: number }>

export default function Footer() {
    return (
        <footer className="footer hover-animate">
            <p>
        <span style={{marginRight: '0.4rem', display: 'inline-flex', alignItems: 'center'}}>
          <Copyright/>
        </span>
                2025 Government AI Curator — All Rights Reserved
            </p>
        </footer>
    )
}

/**
 * A small helper to demonstrate a custom icon style
 */
function Copyright() {
    return <CopyrightIcon size={16} />
}
