import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600">RecuirtPro</h1>
          <p className="text-gray-600 mt-2">Recruitment Automation Platform</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
