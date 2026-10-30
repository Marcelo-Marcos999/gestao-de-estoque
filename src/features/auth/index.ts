/** Única porta de entrada da feature de autenticação. */
export { AuthProvider, useAuth } from './AuthContext'
export { LoginPage } from './pages/LoginPage'
export { SignUpPage } from './pages/SignUpPage'
export { ConfirmEmailPage } from './pages/ConfirmEmailPage'
export { ForgotPasswordPage } from './pages/ForgotPasswordPage'
export { ResetPasswordPage } from './pages/ResetPasswordPage'
export { PasswordRequirements } from './components/PasswordRequirements'
export type { User, UserRole } from './types'
