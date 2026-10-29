
import React from "react";
import "./CategoryCard.css";

function CategoryCard({ icon, name }) {
  return (
    <div className="category-card">
      <div className="category-icon">
        {icon}
      </div>

      <h3>{name}</h3>
    </div>
  );
}

export default CategoryCard;

