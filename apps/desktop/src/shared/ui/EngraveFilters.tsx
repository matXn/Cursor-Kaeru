// SVG filters that cut a shape into the glass, referenced from CSS through `--engrave`.
// The shape's alpha, blurred, is a height map pressed *into* the surface (negative
// surfaceScale); a distant light from the upper left shades the inner walls and leaves the
// flat floor neutral. Mounted once per window.
export function EngraveFilters() {
  return <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
    <defs>
      <filter id="engrave-dark" x="-5%" y="-10%" width="110%" height="120%" colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2.2" result="height" />
        <feDiffuseLighting in="height" surfaceScale={-5} diffuseConstant={1} lightingColor="#fff" result="light">
          <feDistantLight azimuth={225} elevation={30} />
        </feDiffuseLighting>
        <feColorMatrix in="light" values="0 0 0 0 1  0 0 0 0 0.96  0 0 0 0 0.92  2.2 0 0 0 -1.1" result="lit" />
        <feColorMatrix in="light" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.4 0 0 0 1.2" result="shade" />
        <feSpecularLighting in="height" surfaceScale={-5} specularConstant={0.9} specularExponent={30} lightingColor="#ffe8d8" result="spec">
          <feDistantLight azimuth={225} elevation={30} />
        </feSpecularLighting>
        <feMerge result="walls"><feMergeNode in="shade" /><feMergeNode in="lit" /><feMergeNode in="spec" /></feMerge>
        <feComposite in="walls" in2="SourceAlpha" operator="in" result="inside" />
        <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="inside" /></feMerge>
      </filter>
      <filter id="engrave-light" x="-5%" y="-10%" width="110%" height="120%" colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2.2" result="height" />
        <feDiffuseLighting in="height" surfaceScale={-6} diffuseConstant={1} lightingColor="#fff" result="light">
          <feDistantLight azimuth={225} elevation={30} />
        </feDiffuseLighting>
        <feColorMatrix in="light" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  3.2 0 0 0 -1.6" result="lit" />
        <feColorMatrix in="light" values="0 0 0 0 0.16  0 0 0 0 0.09  0 0 0 0 0.05  -3 0 0 0 1.5" result="shade" />
        <feSpecularLighting in="height" surfaceScale={-6} specularConstant={1} specularExponent={30} lightingColor="#fff" result="spec">
          <feDistantLight azimuth={225} elevation={30} />
        </feSpecularLighting>
        <feMerge result="walls"><feMergeNode in="shade" /><feMergeNode in="lit" /><feMergeNode in="spec" /></feMerge>
        <feComposite in="walls" in2="SourceAlpha" operator="in" result="inside" />
        <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="inside" /></feMerge>
      </filter>
    </defs>
  </svg>;
}
