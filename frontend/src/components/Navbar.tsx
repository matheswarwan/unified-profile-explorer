'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Network, Search, Building2, Library, LogOut, User } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const links = [
    { href: '/lookup', label: 'Lookup', icon: Search },
    { href: '/orgs', label: 'Orgs', icon: Building2 },
    { href: '/patterns', label: 'Patterns', icon: Library },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 h-16 bg-gray-900 border-b border-gray-800 flex items-center px-6">
      <div className="flex items-center gap-2 mr-8">
        <Network className="w-6 h-6 text-indigo-400" />
        <span className="font-semibold text-gray-100 text-sm tracking-wide">
          Unified Profile Explorer
        </span>
      </div>

      <div className="flex items-center gap-1 flex-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname.startsWith(href)
                ? 'bg-indigo-500/20 text-indigo-300'
                : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <User className="w-4 h-4" />
            <span>{user.email}</span>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </nav>
  );
}
