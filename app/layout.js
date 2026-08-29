import './ds-variables.css';
import './globals.css';

export const metadata = {
  title: 'Thryve — Health Metric Chart Simulator',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
