// Layout racine : passthrough sans auth (login page vit ici sans protection)
export default function SuperAdminRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
