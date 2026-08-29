import 'tech2heal-design-system/src/tokens/variables.css';
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
