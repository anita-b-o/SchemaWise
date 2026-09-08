# Preservación de dependencias

## Definición

Dada una relación original `R`, un conjunto de dependencias funcionales `F` y
una descomposición `D = {R1, R2, ..., Rn}`, para cada subesquema se calcula la
proyección local:

```text
Fi = πRi(F)
G = F1 ∪ F2 ∪ ... ∪ Fn
```

La descomposición preserva dependencias exactamente cuando `F ⊆ G+`. Esto
significa que todas las restricciones originales pueden imponerse usando sólo
dependencias de los subesquemas, sin reconstruir mediante joins la relación
original.

## Validación de la descomposición

Cada `Ri` debe ser subconjunto de `R.attributes` y la unión de todos los `Ri`
debe cubrir exactamente el esquema original. Los atributos externos producen
un error de scope y los atributos faltantes producen un error de cobertura. Se
mantiene la detección de colisiones de identidad: un mismo ID no puede tener un
nombre distinto.

Un `AttributeSet` vacío se acepta. No aporta atributos ni dependencias
proyectadas y por sí solo no puede satisfacer la cobertura, pero permitirlo
mantiene la API coherente con FD Projection y no altera el resultado matemático.
Los subesquemas repetidos se deduplican.

## Algoritmo y diagnostics

La entrada `F` se materializa una sola vez. Después se obtiene un Minimal Cover
canónico de `F`, se proyecta `F` sobre cada subesquema y se deduplican las FDs
matemáticamente idénticas de la unión `G`.

Para cada FD canónica `X → A` del Minimal Cover se calcula `X+` bajo `G`. Si
`A ∈ X+`, la FD se incluye en `preservedDependencies`; en caso contrario se
incluye en `lostDependencies`. `preserved` es verdadero si y sólo si el segundo
array está vacío. Ambos arrays conservan el orden canónico del Minimal Cover:
cardinalidad del LHS, IDs del LHS e ID del RHS.

Comprobar el Minimal Cover es suficiente porque es equivalente a `F`:
`minimal+ = F+`. Si `G` implica cada FD del cover, también implica todas las FDs
originales. No es necesario ni deseable enumerar `F+`; Attribute Closure prueba
cada implicación requerida de forma directa.

## Dependency preservation y lossless join

Son propiedades independientes. Dependency preservation pregunta si las FDs
originales pueden verificarse localmente. Lossless join pregunta si al unir las
proyecciones de una instancia válida se recupera exactamente la instancia, sin
tuplas espurias. Este checker sólo decide la primera propiedad y no implementa
un chase ni un lossless-join checker general.

Una descomposición puede ser lossless y dependency-preserving. También puede
ser lossless pero no dependency-preserving.

**3NF synthesis guarantees dependency preservation.**

**BCNF decomposition does not guarantee it.**

## Complejidad

El coste incluye un Minimal Cover de `F`, una FD Projection por cada subrelación
y un Attribute Closure por cada FD del cover. FD Projection enumera subconjuntos
de atributos y puede ser exponencial en el tamaño del subesquema; por tanto, el
checker también tiene peor caso exponencial. La implementación no añade caches,
workers ni dependencias externas.
