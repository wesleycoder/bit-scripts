import { type NS, type TIX } from '../types/bitburner';
import DB from './jsondb';
import { sequence } from './utils';

type ScriptOptions = {
  sleepTime: number;
};

let $ns: NS;
let $db: DB;
let $stock: TIX;

const defaultOptions: ScriptOptions = {
  sleepTime: 5000,
};

const flagConfig: [string, string | number | boolean | string[]][] = [];

async function bootstrap(ns: NS) {
  $ns = ns;
  $stock = $ns.stock;
  $ns.disableLog('ALL');
  $ns.tail();

  const flags = $ns.flags(flagConfig);

  $db = new DB($ns, 'stocks.db.txt', flags);
  await $db.init();
}

class Position {
  symbol: string;
  forecast: number;
  isGrowing: boolean;
  growthRate: number;
  rating: number;
  volatility: number;
  max: number;
  long: {
    shares: number;
    avg: number;
    gain: number;
    cost: number;
  };
  short: {
    shares: number;
    avg: number;
    gain: number;
    cost: number;
  };
  constructor(symbol: string) {
    const [longShares, longAvg, shortShares, shortAvg] =
      $stock.getPosition(symbol);
    this.symbol = symbol;
    this.forecast = $stock.getForecast(symbol) * 100 - 50;
    this.isGrowing = this.forecast > 0;
    this.growthRate = Math.floor(this.forecast / 10);
    this.rating = Math.ceil(this.forecast / 5);
    this.volatility = $stock.getVolatility(symbol) * 100;
    this.max = $stock.getMaxShares(symbol);
    this.long = {
      shares: longShares,
      avg: longAvg,
      gain: $stock.getSaleGain(symbol, longShares, 'long'),
      cost: $stock.getAskPrice(symbol),
    };
    this.short = {
      shares: shortShares,
      avg: shortAvg,
      gain: $stock.getSaleGain(symbol, shortShares, 'short'),
      cost: $stock.getBidPrice(symbol),
    };
  }
}

let cycles = 0;

export async function main(ns: NS) {
  await bootstrap(ns);

  const options: ScriptOptions = {
    ...defaultOptions,
    ...(await $ns.flags(flagConfig)),
  };

  const symbols = $stock.getSymbols();

  while (true) {
    $ns.clearLog();
    const positions: Position[] = symbols
      .map((s) => new Position(s))
      .sort((a, b) => b.forecast - a.forecast);
    const myStocks = positions
      .filter(({ long, short }) => long.shares > 0 || short.shares > 0)

      .sort((a, b) => b.long.shares - a.long.shares)
      .sort((a, b) => b.long.gain - a.long.gain)
      .sort((a, b) => b.forecast - a.forecast);

    const topStocks = positions
      .filter(({ long, short }) => long.shares === 0 && short.shares === 0)
      .slice(0, 6);
    $ns.print('         🆔      #️⃣        💰        📊');
    myStocks.forEach((position) => $ns.print(positionRow(position)));
    $ns.print('==============================================');
    $ns.print('         🆔      💸        🌡        📊');
    topStocks.forEach((position) => $ns.print(stockRow(position)));

    await sequence(
      myStocks.filter((s) => s.forecast <= 3),
      async (stock: Position) => {
        $ns.toast(`selling: ${stock.symbol} ➡️ ${stock.long.shares}`, 'error');
        await $stock.sell(stock.symbol, stock.long.shares);
      }
    );

    const bestStock = positions
      .filter((s) => s.long.shares < s.max)
      .filter((s) => s.forecast >= 10)[0];
    if (bestStock) {
      const moneyAvail = Math.floor($ns.getPlayer().money - 501_000_000);
      const sharesToBuy = Math.min(
        Math.floor(moneyAvail / Math.ceil(bestStock.long.cost)),
        bestStock.max - bestStock.long.shares
      );
      const totalCost = sharesToBuy * bestStock.long.cost;

      if (totalCost >= 1_000_000 && (cycles === 0 || cycles % 5 === 0)) {
        const bought = await $stock.buy(bestStock.symbol, sharesToBuy);
        const cost = $ns.nFormat(totalCost, '0,0a');
        const qty = $ns.nFormat(sharesToBuy, '0,0a');
        $ns.toast(
          `buy ➡️ ${bestStock.symbol}: ${qty} ${cost}`,
          bought ? 'info' : 'error'
        );
      }
    }

    cycles++;
    await $ns.sleep(options.sleepTime);
  }
}

const ratingSymbol = (r: number) => {
  if (r > 0) {
    return '+';
  } else if (r < 0) {
    return '-';
  } else {
    return '.';
  }
};

const levels: [string, number][] = [
  ['ERROR', -2],
  ['WARN', 0],
  ['', 2],
  ['INFO', 5],
];

const positionRow = ({ symbol, long, growthRate, rating }: Position) => {
  const level = (
    levels.find(([, limit]) => growthRate <= limit)?.[0] ?? ''
  ).padStart(6);
  const sym = symbol.padStart(6).padEnd(9);
  const longQty = $ns.nFormat(long.shares, '0,0.000a').padEnd(10);
  const longGain = $ns.nFormat(long.gain, '0,0.000a').padEnd(10);
  const rat = ratingSymbol(rating).repeat(Math.abs(rating)).padEnd(7);

  return `${level}${sym}${longQty}${longGain} ${rat.padEnd(8)}`;
};

const stockRow = ({
  symbol,
  long,
  growthRate,
  rating,
  volatility,
}: Position) => {
  const level = (
    levels.find(([, limit]) => growthRate <= limit)?.[0] ?? ''
  ).padStart(6);
  const sym = symbol.padStart(6).padEnd(9);
  const longCost = $ns.nFormat(long.cost, '0,0.000a').padEnd(10);
  const vol = `${volatility.toFixed(2)}%`;
  const rat = ratingSymbol(rating).repeat(Math.abs(rating)).padEnd(7);

  return `${level}${sym}${longCost}${vol}      ${rat}`;
};
