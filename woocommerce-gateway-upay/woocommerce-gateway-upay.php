<?php

/*
  Plugin Name: WooCommerce Upay Payment
  Plugin URI: 
  Description: Extends WooCommerce with Upay payment gateway
  Version: 1.2.7
  Author: EOI
  Author URI: http://www.eoi.co.il
 */
if (!defined('ABSPATH')) {
    exit;
}

//Initialize the gateway.
function woocommerce_upay_init() {
    if (!class_exists('WC_Payment_Gateway')) {
        return;
    } 
    require_once(plugin_basename('includes/class-wc-gateway-upay.php'));
    load_plugin_textdomain('woocommerce-gateway-upay', false, trailingslashit(dirname(plugin_basename(__FILE__))));
    add_filter('woocommerce_payment_gateways', 'woocommerce_upay_add_gateway');
    add_filter('woocommerce_blocks_payment_method_type_registration', 'woocommerce_add_payment_gateways_woocommerce_blocks');
    
    define( 'WC_UPAY_PLUGIN_URL', untrailingslashit( plugins_url( basename( plugin_dir_path( __FILE__ ) ), basename( __FILE__ ) ) ) );
    define( 'WC_UPAY_VERSION', '1.2.7' );
}
add_action('plugins_loaded', 'woocommerce_upay_init', 0);

/* Install and default settings */
function woocommerce_upay_install() {
    update_option('woocommerce_hold_stock_minutes', '');
}
add_action('activate_' . plugin_basename(__FILE__), 'woocommerce_upay_install');

function woocommerce_upay_plugin_links($links) {
    $settings_url = add_query_arg(
            array(
        'page' => 'wc-settings',
        'tab' => 'checkout',
        'section' => 'wc_gateway_upay',
            ), admin_url('admin.php')
    );

    $plugin_links = array(
        '<a href="' . esc_url($settings_url) . '">' . __('Settings', 'woocommerce-gateway-upay') . '</a>'
    );

    return array_merge($links, $plugin_links);
}
add_filter('plugin_action_links_' . plugin_basename(__FILE__), 'woocommerce_upay_plugin_links');

//Add the gateway to WooCommerce
function woocommerce_upay_add_gateway($methods) {
    $methods[] = 'WC_Gateway_Upay';
    return $methods;
}

/* Add to WooCommerce Blocks */
function woocommerce_add_payment_gateways_woocommerce_blocks( \Automattic\WooCommerce\Blocks\Payments\PaymentMethodRegistry $payment_method_registry ) {
    $settings = get_option( 'woocommerce_upay_settings', [] );
    if (isset($settings['support_woocommerce_blocks']) && $settings['support_woocommerce_blocks'] == 'yes' ) {
        require_once(plugin_basename('woocommerce-blocks/Upay.php'));
        $payment_method_instance = new \Automattic\WooCommerce\Blocks\Payments\Integrations\Upay();
        $payment_method_registry->register($payment_method_instance);
    }
}