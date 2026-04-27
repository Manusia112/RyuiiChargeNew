import { Link } from "wouter";
import { categories } from "@/data/games";

const CategoryGrid = () => (
  <section className="py-8" data-testid="category-grid">
    <h2 className="font-display text-2xl font-bold mb-6">Kategori</h2>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {categories.map((cat) => (
        <Link
          key={cat.id}
          to={`/?category=${cat.id}`}
          className="glass-card p-5 text-center hover:border-primary/50 transition-all duration-300 group cursor-pointer block"
          data-testid={`card-category-${cat.id}`}
        >
          <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">{cat.icon}</div>
          <h3 className="font-display font-semibold text-sm mb-1">{cat.label}</h3>
          <p className="text-xs text-muted-foreground">{cat.description}</p>
        </Link>
      ))}
    </div>
  </section>
);

export default CategoryGrid;
