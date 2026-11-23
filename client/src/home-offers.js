// The homepage selection is independent of catalog sorting and stored IDs.
const models = [
  ["Mercedes-Benz", "GLB 200"],
  ["Geely", "Cityray"],
  ["Audi", "A5"],
  ["BMW", "520d xDrive"],
  ["BMW", "M4 Competition"],
  ["Mercedes-Benz", "CLS 250 d"],
];
export function selectHomeOffers(cars) {
  return models
    .map(([brand, model]) =>
      cars.find(
        (car) =>
          car.brand === brand &&
          car.model === model &&
          car.status === "available" &&
          car.displayStatus !== "rented" &&
          !car.archived,
      ),
    )
    .filter(Boolean);
}
