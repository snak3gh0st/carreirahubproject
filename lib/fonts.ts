import localFont from 'next/font/local'

export const blaak = localFont({
  src: [
    { path: '../public/fonts/blaak/Blaak Thin.otf',              weight: '100', style: 'normal' },
    { path: '../public/fonts/blaak/Blaak Thin Italic.otf',       weight: '100', style: 'italic' },
    { path: '../public/fonts/blaak/Blaak Light.otf',             weight: '300', style: 'normal' },
    { path: '../public/fonts/blaak/Blaak Light Italic.otf',      weight: '300', style: 'italic' },
    { path: '../public/fonts/blaak/Blaak Regular.otf',           weight: '400', style: 'normal' },
    { path: '../public/fonts/blaak/Blaak Regular Italic.otf',    weight: '400', style: 'italic' },
    { path: '../public/fonts/blaak/Blaak Bold.otf',              weight: '700', style: 'normal' },
    { path: '../public/fonts/blaak/Blaak Bold Italic.otf',       weight: '700', style: 'italic' },
    { path: '../public/fonts/blaak/Blaak ExtraBold.otf',         weight: '800', style: 'normal' },
    { path: '../public/fonts/blaak/Blaak ExtraBold Italic.otf',  weight: '800', style: 'italic' },
    { path: '../public/fonts/blaak/Blaak Black.otf',             weight: '900', style: 'normal' },
    { path: '../public/fonts/blaak/Blaak Black Italic.otf',      weight: '900', style: 'italic' },
  ],
  variable: '--font-blaak',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
})

export const neueMontreal = localFont({
  src: [
    { path: '../public/fonts/neue-montreal/NeueMontreal-Light.otf',        weight: '300', style: 'normal' },
    { path: '../public/fonts/neue-montreal/NeueMontreal-LightItalic.otf',  weight: '300', style: 'italic' },
    { path: '../public/fonts/neue-montreal/NeueMontreal-Regular.otf',      weight: '400', style: 'normal' },
    { path: '../public/fonts/neue-montreal/NeueMontreal-Italic.otf',       weight: '400', style: 'italic' },
    { path: '../public/fonts/neue-montreal/NeueMontreal-Medium.otf',       weight: '500', style: 'normal' },
    { path: '../public/fonts/neue-montreal/NeueMontreal-MediumItalic.otf', weight: '500', style: 'italic' },
    { path: '../public/fonts/neue-montreal/NeueMontreal-Bold.otf',         weight: '700', style: 'normal' },
    { path: '../public/fonts/neue-montreal/NeueMontreal-BoldItalic.otf',   weight: '700', style: 'italic' },
  ],
  variable: '--font-neue-montreal',
  display: 'swap',
  adjustFontFallback: 'Arial',
})
