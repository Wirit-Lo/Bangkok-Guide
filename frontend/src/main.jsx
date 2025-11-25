import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx' // ตรวจสอบว่า Import ถูกต้อง
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App /> {/* ตรวจสอบว่าเรียกใช้ถูกต้อง */}
  </React.StrictMode>,
)