import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import DashboardPage from './admin/DashboardPage'
import BookingPage from './liff/BookingPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* LIFF: opened by LINE in-app browser */}
        <Route path="/book" element={<BookingPage />} />

        {/* Admin: desktop browser dashboard */}
        <Route path="/admin" element={<DashboardPage />} />

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
