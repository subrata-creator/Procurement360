import type { Cr49f_suppliers } from "../generated/models/Cr49f_suppliersModel";
import type { Cr49f_supplierproducts } from "../generated/models/Cr49f_supplierproductsModel";
import { Cr49f_suppliersService } from "../generated/services/Cr49f_suppliersService";
import { Cr49f_supplierproductsService } from "../generated/services/Cr49f_supplierproductsService";
import { Cr49f_productsesService } from "../generated/services/Cr49f_productsesService";
import { INITIAL_SAMPLE_SUPPLIERS, type SampleSupplierItem } from "../data/SampleSuppliersData";

export interface SeedingResult {
  createdSuppliers: Cr49f_suppliers[];
  createdProducts: Cr49f_supplierproducts[];
  matchedProductsCount: number;
}

const cleanGuid = (id?: string): string => {
  if (!id) return "";
  return String(id).replace(/[{}]/g, "").trim();
};

/**
 * Seeds or syncs 10 suppliers into Dataverse and adds their catalog products,
 * mapped to the products and services present in Dataverse.
 * Idempotent: reuses existing suppliers and avoids duplicate products.
 */
export async function seedSuppliersToDataverse(
  onProgress?: (status: string) => void,
  sampleList: SampleSupplierItem[] = INITIAL_SAMPLE_SUPPLIERS
): Promise<SeedingResult> {
  const notify = (msg: string) => {
    if (onProgress) onProgress(msg);
  };

  notify("Checking existing Dataverse products & suppliers...");
  let presentProductsCount = 0;
  try {
    const presentProductsRes = await Cr49f_productsesService.getAll();
    if (presentProductsRes.data) {
      presentProductsCount = presentProductsRes.data.length;
      notify(`Found ${presentProductsCount} products in Dataverse.`);
    }
  } catch (err) {
    console.warn("Could not query existing Dataverse products:", err);
  }

  // 1. Fetch existing suppliers in Dataverse to avoid duplicate supplier creation
  let existingSuppliers: Cr49f_suppliers[] = [];
  try {
    const suppRes = await Cr49f_suppliersService.getAll();
    if (suppRes.data) {
      existingSuppliers = suppRes.data;
    }
  } catch (err) {
    console.warn("Could not load existing suppliers:", err);
  }

  // 2. Fetch existing supplier products in Dataverse to avoid duplicates
  let existingProducts: Cr49f_supplierproducts[] = [];
  try {
    const prodRes = await Cr49f_supplierproductsService.getAll();
    if (prodRes.data) {
      existingProducts = prodRes.data;
    }
  } catch (err) {
    console.warn("Could not load existing supplier products:", err);
  }

  const createdSuppliers: Cr49f_suppliers[] = [];
  const createdProducts: Cr49f_supplierproducts[] = [];

  const total = sampleList.length;

  for (let i = 0; i < total; i++) {
    const item = sampleList[i];
    const targetName = (item.supplier.cr49f_name || "").toLowerCase().trim();
    const targetCode = (item.supplier.cr49f_supplierid1 || "").toLowerCase().trim();

    // Check if supplier already exists in Dataverse
    let matchedSupplier = existingSuppliers.find((s) => {
      const sName = (s.cr49f_name || "").toLowerCase().trim();
      const sCode = (s.cr49f_supplierid1 || "").toLowerCase().trim();
      return (targetName && sName === targetName) || (targetCode && sCode === targetCode);
    });

    if (!matchedSupplier) {
      notify(`[${i + 1}/${total}] Creating supplier "${item.supplier.cr49f_name}"...`);
      const suppRes = await Cr49f_suppliersService.create(item.supplier);
      if (suppRes.error || !suppRes.data) {
        throw new Error(
          suppRes.error?.message ||
            `Failed to create supplier "${item.supplier.cr49f_name}" in Dataverse.`
        );
      }
      matchedSupplier = suppRes.data;
      createdSuppliers.push(matchedSupplier);
      existingSuppliers.push(matchedSupplier);
    } else {
      notify(`[${i + 1}/${total}] Found existing supplier "${matchedSupplier.cr49f_name}". Checking products...`);
      createdSuppliers.push(matchedSupplier);
    }

    const supplierId = cleanGuid(matchedSupplier.cr49f_supplierid);
    if (!supplierId) {
      console.warn("Skipping supplier with empty ID:", matchedSupplier);
      continue;
    }

    // Now ensure the supplier's products are added
    for (let j = 0; j < item.products.length; j++) {
      const prod = item.products[j];
      const prodName = prod.cr49f_productname.trim().toLowerCase();

      // Check if product already exists for this supplier in Dataverse
      const alreadyHasProd = existingProducts.some((ep) => {
        const epSup = cleanGuid(
          ep._cr49f_supplier_value ||
          (ep as unknown as Record<string, string>)._cr49f_Supplier_value
        );
        const epName = (ep.cr49f_productname || "").trim().toLowerCase();
        return epSup.toLowerCase() === supplierId.toLowerCase() && epName === prodName;
      });

      if (alreadyHasProd) {
        notify(`Product "${prod.cr49f_productname}" already exists for ${matchedSupplier.cr49f_name}.`);
        continue;
      }

      notify(
        `[${i + 1}/${total}] Adding product (${j + 1}/${item.products.length}) "${prod.cr49f_productname}" for ${matchedSupplier.cr49f_name}...`
      );

      // Dataverse schema enforces maxLength: 100 on these string columns
      const prodPayload = {
        "cr49f_Supplier@odata.bind": `/cr49f_suppliers(${supplierId})`,
        cr49f_productname: prod.cr49f_productname.slice(0, 95),
        cr49f_supplierproductnumber: prod.cr49f_supplierproductnumber.slice(0, 95),
        cr49f_producttype: prod.cr49f_producttype,
        cr49f_category: (prod.cr49f_category || "").slice(0, 95),
        cr49f_unitprice: String(prod.cr49f_unitprice || "").slice(0, 95),
        cr49f_warranty: String(prod.cr49f_warranty || "").slice(0, 95),
        cr49f_availability: prod.cr49f_availability,
        cr49f_productdescription: (prod.cr49f_productdescription || "").slice(0, 95),
        statecode: 0 as const,
        statuscode: 1 as const,
      };

      const prodRes = await Cr49f_supplierproductsService.create(prodPayload);
      if (prodRes.error || !prodRes.data) {
        const errDetail = prodRes.error?.message || JSON.stringify(prodRes.error);
        throw new Error(
          `Failed to create product "${prod.cr49f_productname}" for supplier "${matchedSupplier.cr49f_name}": ${errDetail}`
        );
      }

      // Explicitly set _cr49f_supplier_value so the client state immediately maps it to the supplier
      const savedProd: Cr49f_supplierproducts = {
        ...prodRes.data,
        _cr49f_supplier_value: supplierId,
      };

      createdProducts.push(savedProd);
      existingProducts.push(savedProd);
    }
  }

  notify(
    `Completed! ${createdSuppliers.length} suppliers synchronized, ${createdProducts.length} new supplier products created.`
  );

  return {
    createdSuppliers,
    createdProducts,
    matchedProductsCount: presentProductsCount,
  };
}

/**
 * Specifically adds missing supplier products to all suppliers currently in Dataverse.
 */
export async function seedMissingSupplierProductsOnly(
  onProgress?: (status: string) => void
): Promise<Cr49f_supplierproducts[]> {
  const result = await seedSuppliersToDataverse(onProgress);
  return result.createdProducts;
}
