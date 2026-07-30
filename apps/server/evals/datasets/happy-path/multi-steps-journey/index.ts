import { EvalExample } from "../../../lib/types.js";

/**
 * These Prompts are all about a happy path of combinations of multiple api call interaction done through the agent in natural language
 */
export const multiStepsJourneys: EvalExample[] = [
    {
        name: "Multi-Get-N-Products",
        inputs: {
            prompt: "Show me product by id 51 and 52 and 53 and 55"
        },
        referenceOutputs: {
            expectedJourney: ["classify_intent:in_scope", 
                                "dispatch:product_detail", "call_tool:get_product_by_id",  
                                "dispatch:product_detail", "call_tool:get_product_by_id", 
                                "dispatch:product_detail", "call_tool:get_product_by_id",  
                                "dispatch:product_detail", "call_tool:get_product_by_id", 
                                "respond"],
            expectedFinalIntent: "product_detail",
            forbiddenSteps: ["dispatch:search"],
            forbiddenTools: ["search"],
            requiredTools: ["get_product_by_id"],
            expectedToolArgs: [{
                tool: "get_product_by_id",
                args: { id: 51 },
            },
            {
                tool: "get_product_by_id",
                args: { id: 52 },
            },
             {
                tool: "get_product_by_id",
                args: { id: 53 },
            },
             {
                tool: "get_product_by_id",
                args: { id: 55 },
            },
            ]
        }
    },
    {
        name: "Multi-Get-Two-First-products-in-category",
        inputs: {
            prompt: "Show me 20 products in category beauty while skipping first 2 and get the first product's details and the second one as well"
        },
        referenceOutputs: {
            expectedJourney: ["classify_intent:in_scope", 
                                "dispatch:browse_products_by_category", "call_tool:get_products_by_category",  
                                "dispatch:product_detail", "call_tool:get_product_by_id", 
                                "dispatch:product_detail", "call_tool:get_product_by_id", 
                                "respond"],
            expectedFinalIntent: "product_detail",
            forbiddenSteps: ["dispatch:search"],
            forbiddenTools: ["search"],
            requiredTools: ["get_products_by_category", "get_product_by_id"],
            expectedToolArgs: [{
                tool: "get_products_by_category",
                args: { slug: "beauty", limit: 20, skip: 2 },
            },
            ]
        },
        
    },
    {
        name: "Multi-Get-Products-Of-Category",
        inputs: {
            prompt: "Show me all categories that start with 'b' and get products for these categories"
        },
        referenceOutputs: {
            expectedJourney: ["classify_intent:in_scope", 
                                "dispatch:browse_categories", "call_tool:list_categories",  
                                "dispatch:browse_products_by_category", "call_tool:get_products_by_category", 
                                "respond"],
            expectedFinalIntent: "browse_products_by_category",
            forbiddenSteps: ["dispatch:search"],
            forbiddenTools: ["search"],
            requiredTools: ["get_products_by_category", "list_categories"],
            expectedToolArgs: [{
                tool: "list_categories",
                args: {},
            },
            {
                tool: "get_products_by_category",
                args: { slug: "beauty" },
            }
            ]
        },
        
    },
    {
        name: "Multi-Get-Products-Of-Category-And-Get-Cheapest",
        inputs: {
            prompt: "Show me all categories that start with 'b', get products for these categories and finally get the one with the cheapest price"
        },
        referenceOutputs: {
            expectedJourney: ["classify_intent:in_scope", 
                                "dispatch:browse_categories", "call_tool:list_categories",  
                                "dispatch:browse_products_by_category", "call_tool:get_products_by_category", 
                                "dispatch:comparison", 
                                "respond"],
            expectedFinalIntent: "comparison",
            forbiddenSteps: ["dispatch:search"],
            forbiddenTools: ["search"],
            requiredTools: ["get_products_by_category", "list_categories"],
            expectedToolArgs: [{
                tool: "list_categories",
                args: {},
            },
            {
                tool: "get_products_by_category",
                args: { slug: "beauty" },
            },
            
            ]
        },
        
    },
];