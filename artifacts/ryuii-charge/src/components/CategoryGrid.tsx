import { Link } from "wouter";
import { Smartphone, Monitor } from "lucide-react";
import { categories } from "@/data/games";

const iconMap: Record<string, typeof Smartphone> = {
  mobile: Smartphone,
  pc: Monitor,
};

const CategoryGrid = () => (
  <section className="py-8 md:py-10" data-testid="category-grid">
    <h2 className="font-display text-xl md:text-2xl font-bold mb-6">Categories</h2>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {categories.map((cat, i) => {
        const Icon = iconMap[cat.id] || Smartphone;
        return (
          <Link
            key={cat.id}
            to={`/?category=${cat.id}`}
            className="game-card p-5 text-center group cursor-pointer block opacity-0 animate-fade-in-up"
            style={{ animationDelay: `${0.1 + i * 0.08}s` }}
            data-testid={`card-category-${cat.id}`}
          >
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-3 group-hover:bg-primary/20 transition-colors">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-display font-semibold text-sm mb-1">{cat.label}</h3>
            <p className="text-xs text-muted-foreground">{cat.description}</p>
          </Link>
        );
      })}
    </div>
  </section>
);

export default CategoryGrid;
