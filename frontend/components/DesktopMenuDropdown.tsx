"use client";
import React from "react";
import { MdMenu } from "react-icons/md";
import Tooltip from "./Tooltip";

interface DesktopMenuDropdownProps {
  open: boolean;
  toggle: () => void;
  closeOther: () => void;
}

export default function DesktopMenuDropdown({
  open,
  toggle,
  closeOther,
}: DesktopMenuDropdownProps) {
  return (
    <Tooltip text="Menu">
      <button
        className="desktop-menu-button"
        aria-label="Desktop Menu"
        onClick={toggle}
      >
        <MdMenu size={24} />
      </button>
    </Tooltip>
  );
}
