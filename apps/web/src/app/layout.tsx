import { AuthProvider } from "@/context/AuthContext";

export const metadata = {
  title: "BookingOS",
  description: "White-label appointment booking platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
