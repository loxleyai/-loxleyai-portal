export function scoreTarget(t: any) {
  return (
    t.land * 0.3 +
    t.geo * 0.25 +
    t.water * 0.2 +
    t.competition * 0.15 +
    t.logistics * 0.1
  );
}
